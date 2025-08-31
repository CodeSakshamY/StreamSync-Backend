import { supabase } from "../lib/supabaseClient";

export default function Auth() {
  async function signInWithEmail() {
    await supabase.auth.signInWithOtp({ email: "test@example.com" });
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  }

  async function signInWithGitHub() {
    await supabase.auth.signInWithOAuth({ provider: "github" });
  }

  return (
    <div>
      <h1>Login</h1>
      <button onClick={signInWithEmail}>Login with Email</button>
      <button onClick={signInWithGoogle}>Login with Google</button>
      <button onClick={signInWithGitHub}>Login with GitHub</button>
    </div>
  );
}
