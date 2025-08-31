import supabase from "../../lib/supabase";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const { email, password, provider } = req.body;

    if (provider) {
      // Social Login
      const { data, error } = await supabase.auth.signInWithOAuth({ provider });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    } else {
      // Email Signup/Login
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return res.status(400).json({ error: error.message });
      return res.status(200).json(data);
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
