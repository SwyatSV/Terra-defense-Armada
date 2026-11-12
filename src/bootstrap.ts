declare global {
  interface Window {
    armadaShowError: (error: unknown) => void;
  }
}
// Catch module import failures as well as exceptions during the first render.
import("./main.ts").catch((error) => {
  window.armadaShowError(error);
});
export {};
