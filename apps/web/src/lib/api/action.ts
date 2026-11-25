import { toast } from 'sonner';

import { getErrorMessage } from './errors';

/**
 * Runs a mutation and gives the user feedback: a success toast, or a friendly error toast.
 * Returns true when it succeeded so callers can close dialogs or navigate.
 */
export async function runAction<T>(
  action: () => Promise<T>,
  successMessage: string | ((result: T) => string),
): Promise<boolean> {
  try {
    const result = await action();

    toast.success(typeof successMessage === 'function' ? successMessage(result) : successMessage);

    return true;
  } catch (error) {
    toast.error(getErrorMessage(error));

    return false;
  }
}
