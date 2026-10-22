import { NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getAdminContext } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const context = await getAdminContext(req);
    if (!context) {
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
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (!allowedTypes.has(file.type)) {
      return Response.json({ error: "Solo se permiten imágenes JPG, PNG, WebP o AVIF" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return Response.json({ error: "La imagen debe pesar como máximo 8 MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `barberia/${context.tenantId || "platform"}`,
      resource_type: "image",
      overwrite: true,
    });

    return Response.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Error al subir la imagen" }, { status: 500 });
  }
}
