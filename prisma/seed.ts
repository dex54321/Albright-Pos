import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CAT_SEED: Record<string, string[]> = {
  "Building Materials": ["Cement", "Sand", "Ballast", "Binding Wire", "Building Blocks", "Bricks"],
  "Steel & Metal": ["Steel bars", "Steel plates", "Metal sections", "Roofing nails", "Steel products"],
  "Nails & Fasteners": ["Nails", "Screws", "Bolts", "Nuts", "Washers", "Rivets", "Wall plugs"],
  Roofing: ["Roofing sheets", "Roofing nails", "Ridge caps", "Gutters", "Roofing accessories"],
  Plumbing: ["PVC pipes", "PPR pipes", "Elbows", "Tees", "Unions", "Couplers", "Valves", "Water taps", "Shower fittings", "Connectors", "Pipe accessories", "Water tanks"],
  Electrical: ["Cables", "Conduits", "Switches", "Sockets", "Bulbs", "LED lights", "Electrical boxes", "Connectors", "Electrical accessories"],
  "Paint & Finishing": ["Paint", "Thinner", "Turpentine", "Silicone", "Contact adhesive", "Paint brushes", "Rollers", "Sandpaper", "Tile grout", "Tiles", "Wall putty"],
  Tools: ["Hammers", "Pliers", "Spanners", "Screwdrivers", "Blades", "Hacksaws", "Trowels", "Shovels", "Hoes", "Wheelbarrows", "Levels", "Measuring tools"],
  "Timber & Boards": ["Plywood", "Timber", "MDF", "Boards"],
  "General Hardware": ["Locks", "Hinges", "Padlocks", "Chains", "Hooks", "Buckets", "Miscellaneous hardware"],
};

const UNIT_SEED: [string, boolean][] = [
  ["Piece", false], ["Box", false], ["Packet", false], ["Bag", false], ["Kg", true], ["Gram", true],
  ["Metre", true], ["Roll", false], ["Coil", false], ["Length", false], ["Litre", true], ["Tin", false],
  ["Carton", false], ["Pair", false], ["Set", false], ["Dozen", false],
];

// [name, category, subcategory, unit, buy, sell, stock, minStock]
const PROD_SEED: [string, string, string, string, number, number, number, number][] = [
  ["Cement 50kg", "Building Materials", "Cement", "Bag", 880, 900, 120, 30],
  ["Binding wire", "Building Materials", "Binding Wire", "Kg", 150, 200, 80, 20],
  ["Steel bar D8", "Steel & Metal", "Steel bars", "Piece", 620, 720, 60, 15],
  ["Steel bar D10", "Steel & Metal", "Steel bars", "Piece", 920, 1020, 45, 15],
  ["Steel bar D12", "Steel & Metal", "Steel bars", "Piece", 1320, 1370, 30, 10],
  ["Tube 1x1", "Steel & Metal", "Metal sections", "Length", 520, 580, 40, 10],
  ["Mabati 3m gauge 30", "Roofing", "Roofing sheets", "Piece", 1140, 1250, 60, 15],
  ["Roofing nails", "Roofing", "Roofing accessories", "Kg", 200, 300, 30, 8],
  ["Nails 2\"", "Nails & Fasteners", "Nails", "Kg", 160, 200, 40, 10],
  ["Nails 3\"", "Nails & Fasteners", "Nails", "Kg", 150, 200, 50, 10],
  ["Nails 4\"", "Nails & Fasteners", "Nails", "Kg", 150, 200, 60, 12],
  ["Nails 5\"", "Nails & Fasteners", "Nails", "Kg", 150, 200, 35, 10],
  ["Bolts 6\"", "Nails & Fasteners", "Bolts", "Piece", 8, 20, 150, 40],
  ["PVC pipe 4\"", "Plumbing", "PVC pipes", "Length", 875, 1300, 14, 4],
  ["Elbow 4\"", "Plumbing", "Elbows", "Piece", 90, 200, 30, 8],
  ["Gate valve 1\"", "Plumbing", "Valves", "Piece", 870, 1200, 8, 3],
  ["Water tank 2000L", "Plumbing", "Water tanks", "Piece", 15000, 16000, 3, 1],
  ["Conduit pipe", "Electrical", "Conduits", "Length", 72, 100, 80, 20],
  ["Bulb 9W", "Electrical", "Bulbs", "Piece", 60, 120, 60, 15],
  ["Double socket", "Electrical", "Sockets", "Piece", 200, 300, 20, 6],
  ["Paint 1L", "Paint & Finishing", "Paint", "Litre", 260, 350, 30, 8],
  ["Silicone", "Paint & Finishing", "Silicone", "Piece", 180, 250, 30, 8],
  ["Tile grout", "Paint & Finishing", "Tile grout", "Kg", 60, 150, 60, 15],
  ["Hammer (nyundo)", "Tools", "Hammers", "Piece", 240, 300, 15, 4],
  ["Wheelbarrow", "Tools", "Wheelbarrows", "Piece", 430, 600, 6, 2],
  ["Plywood 8x4", "Timber & Boards", "Plywood", "Piece", 380, 450, 50, 10],
  ["Hinges", "General Hardware", "Hinges", "Pair", 20, 50, 80, 20],
  ["Padlock", "General Hardware", "Padlocks", "Piece", 70, 100, 30, 8],
];

async function main() {
  console.log("Seeding...");

  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  // Users - CHANGE THESE PASSWORDS after first login.
  for (const [name, username, role, pw] of [
    ["Administrator", "admin", "admin", "admin123"],
    ["Shop Manager", "manager", "manager", "manager123"],
    ["Cashier 1", "cashier", "cashier", "cashier123"],
  ] as const) {
    const passwordHash = await bcrypt.hash(pw, 10);
    await prisma.user.upsert({
      where: { username },
      create: { name, username, role, passwordHash, active: true },
      update: {},
    });
  }

  const catId = new Map<string, number>();
  for (const [name, subs] of Object.entries(CAT_SEED)) {
    const existingTop = await prisma.category.findFirst({ where: { name, parentId: null } });
    const topRow = existingTop ?? (await prisma.category.create({ data: { name, parentId: null } }));
    catId.set(name, topRow.id);
    for (const s of subs) {
      const existing = await prisma.category.findFirst({ where: { name: s, parentId: topRow.id } });
      const sub = existing ?? (await prisma.category.create({ data: { name: s, parentId: topRow.id } }));
      catId.set(`${name}>${s}`, sub.id);
    }
  }

  const unitId = new Map<string, number>();
  for (const [name, decimal] of UNIT_SEED) {
    const u = await prisma.unit.upsert({ where: { name }, create: { name, decimal }, update: {} });
    unitId.set(name, u.id);
  }

  const suppliers = await Promise.all(
    [
      { name: "Nairobi Cement Distributors", company: "Bamburi & Savannah dealer", phone: "+254711000111", location: "Industrial Area" },
      { name: "Mabati & Steel Agencies", company: "Steel, tubes, roofing", phone: "+254722000222", location: "Ruaraka" },
      { name: "Plumbing & Electricals Wholesale", company: "Pipes, fittings, switches", phone: "+254733000333", location: "Gikomba" },
    ].map(async (s) => {
      const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
      return existing ?? prisma.supplier.create({ data: s });
    })
  );

  await Promise.all(
    [
      { name: "Peter Kamau", type: "contractor" as const, phone: "+254712345678", location: "Kasarani", creditLimit: 100000 },
      { name: "Green Valley Builders", type: "company" as const, phone: "+254722111222", location: "Ruiru", creditLimit: 200000 },
      { name: "Mary Wanjiru", type: "regular" as const, phone: "+254733222111", location: "Roysambu", creditLimit: 20000 },
    ].map(async (c) => {
      const existing = await prisma.customer.findFirst({ where: { name: c.name } });
      return existing ?? prisma.customer.create({ data: c });
    })
  );

  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  let count = await prisma.product.count();
  for (const [name, cat, sub, unit, buy, sell, stock] of PROD_SEED) {
    const existing = await prisma.product.findFirst({ where: { name } });
    if (existing) continue;
    count++;
    const p = await prisma.product.create({
      data: {
        sku: `HW-${String(count).padStart(5, "0")}`,
        name,
        categoryId: catId.get(cat) ?? null,
        subId: catId.get(`${cat}>${sub}`) ?? null,
        unitId: unitId.get(unit)!,
        buyPrice: buy,
        sellPrice: sell,
        wholesale: sell,
        minSell: buy,
        minStock: 5,
        supplierId: suppliers[0].id,
      },
    });
    await prisma.product.update({ where: { id: p.id }, data: { stock } });
    await prisma.stockMovement.create({
      data: { productId: p.id, type: "adjustment", qty: stock, prevStock: 0, newStock: stock, reason: "Opening stock (seed)", userId: admin.id },
    });
  }

  console.log("Seed complete.");
  console.log("Login as: admin/admin123, manager/manager123, cashier/cashier123");
  console.log("CHANGE THESE PASSWORDS under Users before real use.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
