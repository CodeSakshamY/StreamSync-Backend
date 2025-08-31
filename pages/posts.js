
import { supabase } from '../../supabaseClient';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('posts').select('*').order('created_at');
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json(data);
  }
  if (req.method === 'POST') {
    const { user_id, title, image_url } = req.body;
    const { data, error } = await supabase.from('posts').insert([{ user_id, title, image_url }]);
    if (error) return res.status(400).json({ error: error.message });
    res.status(200).json(data);
  }
}
