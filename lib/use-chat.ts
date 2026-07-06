"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { apiClient, getAccessToken } from "@/lib/api-client"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export type ChatRole = "user" | "assistant" | "system"

export interface ChatMessage {
    _id?: string
    role: ChatRole
    content: string
    createdAt?: string
    /** True while tokens are still streaming in for this assistant message. */
    streaming?: boolean
}

export interface Conversation {
    _id: string
    title: string
    socialAccountId: string
    messageCount: number
    lastMessageAt: string
    createdAt: string
}

interface UseChatOptions {
    workspaceId: string | null
    socialAccountId: string | null
    /** When true, the most-recent conversation for this account auto-loads on mount. */
    autoOpenLatest?: boolean
}

interface UseChatApi {
    conversations: Conversation[]
    activeConversation: Conversation | null
    messages: ChatMessage[]
    isStreaming: boolean
    error: string | null
    send: (content: string) => Promise<void>
    newConversation: () => void
    openConversation: (id: string) => Promise<void>
    removeConversation: (id: string) => Promise<void>
    refreshConversations: () => Promise<void>
}

/**
 * Hook that talks to the persisted SSE-streaming chat backend at
 * /api/v1/ai/chat/*. Designed to be shared by Insights and AI Studio.
 *
 * Behavior:
 * - On mount, lists conversations matching (workspaceId, surface, toolId?,
 *   socialAccountId?). If `autoOpenLatest`, opens the most recent one.
 * - `send()` lazily creates a conversation on the first message of a fresh
 *   thread, then streams the assistant reply token-by-token.
 * - `newConversation()` clears local state without touching the server —
 *   the next `send()` will create one.
 */
export function useChat(opts: UseChatOptions): UseChatApi {
    const { workspaceId, socialAccountId, autoOpenLatest = true } = opts

    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const abortRef = useRef<AbortController | null>(null)

    const buildListUrl = useCallback(() => {
        if (!workspaceId) return null
        const params = new URLSearchParams({ workspaceId })
        if (socialAccountId) params.set("socialAccountId", socialAccountId)
        return `/api/v1/ai/chat/conversations?${params.toString()}`
    }, [workspaceId, socialAccountId])

    const refreshConversations = useCallback(async () => {
        const url = buildListUrl()
        if (!url) {
            setConversations([])
            return
        }
        try {
            const all = await apiClient.get<Conversation[]>(url)
            setConversations(all ?? [])
        } catch (err) {
            console.error("Failed to load conversations", err)
        }
    }, [buildListUrl])

    const openConversation = useCallback(
        async (id: string) => {
            if (!workspaceId) return
            try {
                const result = await apiClient.get<{ conversation: Conversation; messages: ChatMessage[] }>(
                    `/api/v1/ai/chat/conversations/${id}?workspaceId=${workspaceId}`,
                )
                setActiveConversation(result.conversation)
                setMessages(result.messages.map((m) => ({ ...m, streaming: false })))
                setError(null)
            } catch (err) {
                console.error("Failed to open conversation", err)
                setError("Couldn’t load conversation.")
            }
        },
        [workspaceId],
    )

    const newConversation = useCallback(() => {
        abortRef.current?.abort()
        setActiveConversation(null)
        setMessages([])
        setError(null)
    }, [])

    const removeConversation = useCallback(
        async (id: string) => {
            if (!workspaceId) return
            try {
                await apiClient.delete(`/api/v1/ai/chat/conversations/${id}?workspaceId=${workspaceId}`)
                setConversations((prev) => prev.filter((c) => c._id !== id))
                if (activeConversation?._id === id) {
                    newConversation()
                }
            } catch (err) {
                console.error("Failed to delete conversation", err)
            }
        },
        [workspaceId, activeConversation, newConversation],
    )

    const send = useCallback(
        async (content: string) => {
            const trimmed = content.trim()
            if (!trimmed || !workspaceId || !socialAccountId || isStreaming) return

            setError(null)

            // Lazily create the server-side conversation on first send so we
            // don't litter Mongo with empty threads when the user toys with
            // the UI.
            let conv = activeConversation
            if (!conv) {
                try {
                    conv = await apiClient.post<Conversation>("/api/v1/ai/chat/conversations", {
                        workspaceId,
                        socialAccountId,
                    })
                    setActiveConversation(conv)
                    setConversations((prev) => [conv as Conversation, ...prev])
                } catch (err) {
                    setError("Couldn’t start a new conversation.")
                    return
                }
            }

            const userMsg: ChatMessage = { role: "user", content: trimmed }
            const placeholder: ChatMessage = { role: "assistant", content: "", streaming: true }
            setMessages((prev) => [...prev, userMsg, placeholder])

            const ctrl = new AbortController()
            abortRef.current = ctrl
            setIsStreaming(true)

            try {
                const token = getAccessToken()
                const res = await fetch(
                    `${BASE_URL}/api/v1/ai/chat/conversations/${conv._id}/messages`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        credentials: "include",
                        body: JSON.stringify({ workspaceId, content: trimmed }),
                        signal: ctrl.signal,
                    },
                )

                if (!res.ok || !res.body) {
                    throw new Error(`Stream failed (${res.status})`)
                }

                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ""

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })

                    const frames = buffer.split("\n\n")
                    buffer = frames.pop() ?? ""

                    for (const frame of frames) {
                        const lines = frame.split("\n")
                        let eventName = "message"
                        const dataLines: string[] = []
                        for (const ln of lines) {
                            if (ln.startsWith("event: ")) eventName = ln.slice(7).trim()
                            else if (ln.startsWith("data: ")) dataLines.push(ln.slice(6))
                        }
                        const dataRaw = dataLines.join("\n").trim()
                        if (!dataRaw) continue
                        if (dataRaw === "[DONE]") continue

                        try {
                            const parsed = JSON.parse(dataRaw)
                            if (eventName === "done") {
                                // Final metadata frame — update title/messageCount.
                                if (parsed.title || parsed.messageCount != null) {
                                    setActiveConversation((prev) =>
                                        prev
                                            ? {
                                                  ...prev,
                                                  title: parsed.title ?? prev.title,
                                                  messageCount: parsed.messageCount ?? prev.messageCount,
                                                  lastMessageAt: new Date().toISOString(),
                                              }
                                            : prev,
                                    )
                                    setConversations((prev) =>
                                        prev.map((c) =>
                                            c._id === parsed.conversationId
                                                ? {
                                                      ...c,
                                                      title: parsed.title ?? c.title,
                                                      messageCount: parsed.messageCount ?? c.messageCount,
                                                      lastMessageAt: new Date().toISOString(),
                                                  }
                                                : c,
                                        ),
                                    )
                                }
                            } else if (parsed.error) {
                                setError(String(parsed.error))
                            } else if (typeof parsed.delta === "string") {
                                setMessages((prev) => {
                                    const next = [...prev]
                                    const last = next[next.length - 1]
                                    if (last?.role === "assistant") {
                                        next[next.length - 1] = {
                                            ...last,
                                            content: last.content + parsed.delta,
                                        }
                                    }
                                    return next
                                })
                            }
                        } catch {
                            // Ignore malformed frames; the buffer split should keep us safe.
                        }
                    }
                }
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    setError("Streaming failed. Try again.")
                }
            } finally {
                setIsStreaming(false)
                setMessages((prev) =>
                    prev.map((m, i) =>
                        i === prev.length - 1 && m.role === "assistant" ? { ...m, streaming: false } : m,
                    ),
                )
            }
        },
        [workspaceId, socialAccountId, activeConversation, isStreaming],
    )

    // Initial load + auto-open most recent for the (workspace, account) pair.
    useEffect(() => {
        let cancelled = false
        const url = buildListUrl()
        if (!url) {
            setConversations([])
            setActiveConversation(null)
            setMessages([])
            return
        }

        ;(async () => {
            try {
                const all = await apiClient.get<Conversation[]>(url)
                if (cancelled) return
                const list = all ?? []
                setConversations(list)

                if (autoOpenLatest && list.length > 0) {
                    await openConversation(list[0]._id)
                } else {
                    setActiveConversation(null)
                    setMessages([])
                }
            } catch (err) {
                console.error("useChat init failed", err)
            }
        })()

        return () => {
            cancelled = true
            abortRef.current?.abort()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceId, socialAccountId])

    return {
        conversations,
        activeConversation,
        messages,
        isStreaming,
        error,
        send,
        newConversation,
        openConversation,
        removeConversation,
        refreshConversations,
    }
}
