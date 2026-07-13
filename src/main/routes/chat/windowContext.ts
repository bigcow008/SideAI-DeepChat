import type { CreateSessionInput, SendMessageInput } from '@shared/types/agent-interface'
import type { WindowContextSnapshot } from '@shared/windowFollower'

type WindowContextPresenter = {
  captureWindowContextForMessage(): Promise<WindowContextSnapshot | null>
}

export async function attachWindowContextToMessage(
  presenter: WindowContextPresenter,
  content: string | SendMessageInput
): Promise<string | SendMessageInput> {
  const windowContext = await presenter.captureWindowContextForMessage()
  if (!windowContext) return content

  if (typeof content === 'string') {
    return { text: content, files: [], windowContext }
  }
  return { ...content, windowContext }
}

export async function attachWindowContextToSession(
  presenter: WindowContextPresenter,
  input: CreateSessionInput
): Promise<CreateSessionInput> {
  const hasInitialMessage = input.message.trim().length > 0 || (input.files?.length ?? 0) > 0
  if (!hasInitialMessage) return input

  const windowContext = await presenter.captureWindowContextForMessage()
  return windowContext ? { ...input, windowContext } : input
}
