type Listener = () => void;

const listeners = new Set<Listener>();

/** Lets the API layer tell the app "the session is over" without importing React. */
export const sessionEvents = {
  onExpired(listener: Listener): () => void {
    listeners.add(listener);

    return () => listeners.delete(listener);
  },

  emitExpired(): void {
    listeners.forEach((listener) => listener());
  },
};
