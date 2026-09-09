export {};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      on: (event: string, handler: () => void) => void;
      open: () => void;
    };
  }
}
