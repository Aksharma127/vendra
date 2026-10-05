export const THEME_STORAGE_KEY = "vendra-theme";

/**
 * Runs before first paint (inlined by app/layout.tsx) so a dark-mode visitor
 * never sees a white flash. Kept in its own module, not in the client
 * component, so the server layout doesn't pull a client bundle in just to read
 * a string. Deliberately tiny and fully guarded: anything that throws here
 * would block rendering.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;
