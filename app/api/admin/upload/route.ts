import { NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    if (!(await requireAdmin(req))) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return Response.json(
        { error: "Faltan las credenciales de Cloudinary" },
        { status: 500 }
      );
    }

    const data = await req.formData();
    const file = data.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
    }

    const folder = data.get("folder");
    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: typeof folder === "string" && folder ? folder : "barberia",
      resource_type: "image",
      overwrite: true,
    });

    return Response.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
