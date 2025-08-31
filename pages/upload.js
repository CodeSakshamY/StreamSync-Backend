
import { supabase } from '../../supabaseClient';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const fileName = `meme-${Date.now()}.png`;
    const { data, error } = await supabase.storage.from('memes').upload(fileName, buffer, { contentType: 'image/png' });
    if (error) return res.status(400).json({ error: error.message });
    const { data: publicUrlData } = supabase.storage.from('memes').getPublicUrl(fileName);
    res.status(200).json({ url: publicUrlData.publicUrl });
  }
}
