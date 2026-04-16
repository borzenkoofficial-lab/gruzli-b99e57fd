const ACTIVE_CONVERSATION_ATTR = "data-active-conversation-id";

export function setActiveConversationId(conversationId: string | null) {
  if (typeof document === "undefined") return;

  if (conversationId) {
    document.body.setAttribute(ACTIVE_CONVERSATION_ATTR, conversationId);
  } else {
    document.body.removeAttribute(ACTIVE_CONVERSATION_ATTR);
  }
}

export function getActiveConversationId() {
  if (typeof document === "undefined") return null;
  return document.body.getAttribute(ACTIVE_CONVERSATION_ATTR);
}