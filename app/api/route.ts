import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "banners") {
    const banners = await prisma.banner.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
    return NextResponse.json(banners);
  }

  const query = searchParams.get("query")?.trim() || "";
  const where: any = { isActive: true };

  if (query) {
    const cleanNum = query.replace(/[^0-9]/g, "");
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { address: { contains: query, mode: "insensitive" } },
      { servedCities: { some: { city: { name: { contains: query, mode: "insensitive" } } } } }
    ];
    if (cleanNum.length >= 3) {
      where.OR.push({ contacts: { some: { phone: { contains: cleanNum } } } });
    }
  }

  const records = await prisma.transportCompany.findMany({
    where,
    take: 20,
    include: {
      contacts: { orderBy: { sortOrder: "asc" } },
      servedCities: { include: { city: true } },
      reviews: { where: { isApproved: true }, select: { rating: true } }
    },
    orderBy: { name: "asc" }
  });

  const formatted = records.map((t) => ({
    id: t.id,
    name: t.name,
    startingPlace: t.startingPlace,
    address: t.address || "",
    contacts: t.contacts.map((c) => ({ phone: c.phone, caption: c.caption || "" })),
    servedCities: t.servedCities.map((sc) => sc.city.name).sort(),
    totalReviews: t.reviews.length,
    averageRating: t.reviews.length > 0 ? Number((t.reviews.reduce((a, r) => a + r.rating, 0) / t.reviews.length).toFixed(1)) : 0
  }));

  return NextResponse.json({ records: formatted });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  // Excel Upload Handler
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const wb = XLSX.read(bytes, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]);
    let count = 0;

    for (const row of rows) {
      const name = String(row["Transport Name"] || row["Name"] || "").trim();
      if (!name) continue;
      const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const address = String(row["Address"] || "").trim();
      const rawPlaces = String(row["Place"] || row["Places Served"] || "");
      const cities = rawPlaces.split(/[,/;|\n]+/).map((c) => c.trim()).filter((c) => c.length > 1);

      let comp = await prisma.transportCompany.findFirst({ where: { normalizedName: norm } });
      if (!comp) {
        comp = await prisma.transportCompany.create({ data: { name, normalizedName: norm, address, startingPlace: "Hubli" } });
        count++;
      }

      for (const cityName of cities) {
        const normCity = cityName.toLowerCase().trim();
        const city = await prisma.city.upsert({
          where: { normalizedName: normCity },
          update: {},
          create: { name: cityName, normalizedName: normCity }
        });
        await prisma.transportCity.upsert({
          where: { transportId_cityId: { transportId: comp.id, cityId: city.id } },
          update: {},
          create: { transportId: comp.id, cityId: city.id }
        });
      }

      const rawContacts = [row["CONTACT1"], row["CONTACT 2"], row["CONTACT 3"]];
      for (const rc of rawContacts) {
        if (!rc) continue;
        const str = String(rc).trim();
        const match = str.match(/(.*?)\((.*?)\)/);
        const phone = (match ? match[1] : str).replace(/[^0-9]/g, "").slice(-10);
        const caption = match ? match[2].trim() : "";
        if (phone.length >= 7) {
          const exists = await prisma.transportContact.findFirst({ where: { transportId: comp.id, phone } });
          if (!exists) {
            await prisma.transportContact.create({ data: { transportId: comp.id, phone, caption } });
          }
        }
      }
    }
    return NextResponse.json({ success: true, message: `Processed ${count} new transports and merged records!` });
  }

  // JSON Actions (Share, Suggest, Review)
  const body = await req.json();

  if (body.action === "share") {
    if (!body.transportIds || body.transportIds.length > 5) {
      return NextResponse.json({ error: "Maximum 5 transports allowed" }, { status: 400 });
    }
    const comps = await prisma.transportCompany.findMany({
      where: { id: { in: body.transportIds } },
      include: { contacts: true, servedCities: { include: { city: true } } }
    });
    const footerSetting = await prisma.appSetting.findUnique({ where: { key: "whatsapp_footer_text" } });
    const footer = footerSetting?.value || "Visit Jain Computers, Hubli for all your IT & Printers Needs.";

    let text = "*TRANSPORT DETAILS*\n\n";
    comps.forEach((c, idx) => {
      text += `*${idx + 1}. ${c.name.toUpperCase()}*\n`;
      if (c.address) text += `Address: ${c.address}\n`;
      c.contacts.forEach((ct, cIdx) => {
        text += `Contact ${cIdx + 1}: ${ct.phone}${ct.caption ? ` (${ct.caption})` : ""}\n`;
      });
      text += `Places Served: ${c.servedCities.map((sc) => sc.city.name).join(", ")}\n\n`;
    });
    text += `> ${footer}\n`;

    return NextResponse.json({ url: `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}` });
  }

  if (body.action === "suggest") {
    await prisma.suggestion.create({
      data: {
        name: body.name,
        address: body.address || "",
        placesServed: body.placesServed || "",
        suggestedBy: body.suggestedBy,
        contact1: body.contact1 || "",
        caption1: body.caption1 || ""
      }
    });
    return NextResponse.json({ success: true });
  }

  if (body.action === "review") {
    await prisma.review.create({
      data: {
        transportId: body.transportId,
        userName: body.userName,
        rating: Number(body.rating) || 5,
        comment: body.comment || ""
      }
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
