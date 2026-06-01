import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { title, type, platform, generatedText } = await request.json();
    const userId = session.user.id;

    const result = await sql`
      INSERT INTO generated_content (user_id, title, type, platform, generated_text)
      VALUES (${userId}, ${title}, ${type}, ${platform}, ${JSON.stringify(generatedText)})
      RETURNING id
    `;

    return Response.json({ success: true, id: result[0].id });
  } catch (error) {
    console.error("Save Content Error:", error);
    return Response.json({ error: "Failed to save content" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const content = await sql`
      SELECT * FROM generated_content 
      WHERE user_id = ${userId} 
      ORDER BY created_at DESC
    `;

    return Response.json({ content });
  } catch (error) {
    console.error("Get Content Error:", error);
    return Response.json({ error: "Failed to fetch content" }, { status: 500 });
  }
}
