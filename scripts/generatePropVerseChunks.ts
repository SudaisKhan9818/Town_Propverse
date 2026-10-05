import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type Entity = Record<string, unknown>;
type RawTown = Record<string, Entity[]> & { town?: string };

const root = process.cwd();
const townName = 'PropVerse Town';

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value
    .replaceAll('PropVerse Town 01', townName)
    .replaceAll('PropVerse Town 001', townName)
    .replaceAll('Town 01', townName)
    .replaceAll('Town 001', townName)
    .replaceAll('â€™', "'")
    .replaceAll('â€“', '–')
    .replaceAll('Â·', '·')
    .trim() : fallback;
}

function number(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function position(entity: Entity): number[] {
  return list(entity.position).filter((value): value is number => typeof value === 'number');
}

function publicMetadata(entity: Entity, metadata: Record<string, unknown>): Record<string, unknown> {
  return {
    id: text(entity.id),
    town: townName,
    focusTarget: text(entity.id),
    position: position(entity),
    ...metadata,
  };
}

function houseChunk(house: Entity) {
  const id = text(house.id);
  const marla = Number.parseInt(text(house.type).match(/\d+/)?.[0] ?? '0', 10);
  const bedrooms = number(house.bedrooms);
  const price = house.price as Entity | undefined;
  const priceLakh = Math.round(number(price?.totalPkr) / 100000);
  const status = text(house.status).toLowerCase();
  const isFree = status === 'free';
  const statusTag = isFree ? 'FREE' : 'OCCUPIED';
  const roadName = text(house.roadName, 'the town road network');
  const facing = text(house.facing, 'the town-facing direction');
  const possession = text(house.possession, 'to be confirmed');
  const availability = isFree
    ? 'It is currently available for booking.'
    : `Its current occupancy status is ${status}.`;
  const content = [
    `[ID: ${id}] [BLOCK: P] [TYPE: FOR_SALE] [STATUS: ${statusTag}] [NOT_FOR_RENT]`,
    `PropVerse Town, Block P, ${text(house.type)} ${text(house.houseType, 'double-storey bungalow')}, ${bedrooms} bedrooms, price ${priceLakh} Lakh, located on ${roadName}.`,
    `The home faces ${facing}, possession is ${possession}, and it is planned for comfortable family living.`,
    `This property is ONLY FOR SALE, not for rent. ${availability}`,
  ].join(' ');

  return {
    id,
    content,
    metadata: publicMetadata(house, {
      block: 'P',
      type: 'sale',
      status: isFree ? 'free' : 'occupied',
      marla,
      bedrooms,
      price_lakh: priceLakh,
      roadName,
      streetId: text(house.streetId),
      facing,
      possession,
    }),
  };
}

function civicChunk(entity: Entity, category: string) {
  const id = text(entity.id);
  const name = text(entity.name, category);
  const roadName = text(entity.roadName, 'the town road network');
  const description = text(entity.description, `${name} supports residents and visitors.`);
  const timings = text(entity.timings, 'operating hours are listed by the facility');
  const capacity = text(entity.capacity);
  const capacitySentence = capacity ? ` Capacity is ${capacity}.` : '';
  const content = [
    `[ID: ${id}] [TYPE: GENERAL_INFO] [STATUS: ACTIVE]`,
    `PropVerse Town includes ${name}, a ${category} facility on ${roadName}.`,
    `${description} Public timings are ${timings}.${capacitySentence}`,
    `Residents can use this facility as part of the town's connected civic and community services.`,
  ].join(' ');
  return {
    id,
    content,
    metadata: publicMetadata(entity, {
      type: 'general',
      entityType: category,
      status: 'active',
      roadName,
      capacity: capacity || null,
    }),
  };
}

function lightChunk(light: Entity) {
  const id = text(light.id);
  const roadName = text(light.roadName, 'the internal road network');
  const content = [
    `[ID: ${id}] [TYPE: GENERAL_INFO] [STATUS: ACTIVE]`,
    `PropVerse Town streetlight ${id} is installed along ${roadName} as part of the internal lighting network.`,
    `This active streetlight pole provides nighttime illumination for residents, visitors, pedestrians, and vehicles.`,
    `It supports safer movement through the town road system and is maintained as public infrastructure.`,
  ].join(' ');
  return {
    id,
    content,
    metadata: publicMetadata(light, {
      type: 'general',
      entityType: 'streetlight',
      status: 'active',
      roadName,
      roadId: text(light.roadId),
    }),
  };
}

function roadChunk(road: Entity) {
  const id = text(road.id);
  const roadName = text(road.roadName, id);
  const content = [
    `[ID: ${id}] [TYPE: GENERAL_INFO] [STATUS: ACTIVE]`,
    `PropVerse Town road ${roadName} is part of the planned circulation network.`,
    `It has a width of ${number(road.width)} metres, a length of ${number(road.length)} metres, and ${text(road.orientation, 'planned')} orientation.`,
    `The road connects residential, commercial, and civic destinations for practical everyday access.`,
  ].join(' ');
  return {
    id,
    content,
    metadata: publicMetadata(road, {
      type: 'general',
      entityType: 'road',
      status: 'active',
      roadName,
      width: number(road.width),
      length: number(road.length),
      orientation: text(road.orientation),
    }),
  };
}

function wallChunk(wall: Entity) {
  const id = text(wall.id);
  const segments = number(wall.segmentCount);
  const content = [
    `[ID: ${id}] [TYPE: GENERAL_INFO] [STATUS: ACTIVE]`,
    `PropVerse Town boundary wall run ${id} forms part of the secured town perimeter.`,
    `This boundary section contains ${segments} planned segments and helps define the protected edge of the development.`,
    `It supports clear site limits, community security, and an organized arrival experience for residents and visitors.`,
  ].join(' ');
  return {
    id,
    content,
    metadata: publicMetadata(wall, {
      type: 'general',
      entityType: 'boundary wall',
      status: 'active',
      segmentCount: segments,
    }),
  };
}

async function main() {
  const raw = JSON.parse(await readFile(path.join(root, 'src', 'data', 'town_raw.json'), 'utf8')) as RawTown;
  const chunks = [
    ...list(raw.houses).map((entity) => houseChunk(entity as Entity)),
    ...list(raw.lights).map((entity) => lightChunk(entity as Entity)),
    ...list(raw.roads).map((entity) => roadChunk(entity as Entity)),
    ...list(raw.markets).map((entity) => civicChunk(entity as Entity, 'market')),
    ...list(raw.masjids).map((entity) => civicChunk(entity as Entity, 'masjid')),
    ...list(raw.schools).map((entity) => civicChunk(entity as Entity, 'school')),
    ...list(raw.hospitals).map((entity) => civicChunk(entity as Entity, 'hospital')),
    ...list(raw.parks).map((entity) => civicChunk(entity as Entity, 'park')),
    ...list(raw.gridStations).map((entity) => civicChunk(entity as Entity, 'grid station')),
    ...list(raw.policeStations).map((entity) => civicChunk(entity as Entity, 'police station')),
    ...list(raw.fireStations).map((entity) => civicChunk(entity as Entity, 'fire station')),
    ...list(raw.boundaryWalls).map((entity) => wallChunk(entity as Entity)),
  ];

  if (chunks.length !== 124) throw new Error(`Expected 124 chunks, generated ${chunks.length}.`);
  const output = `${JSON.stringify(chunks, null, 2)}\n`;
  await writeFile(path.join(root, 'scripts', 'propverse_town_chunks.json'), output, 'utf8');
  await writeFile(path.join(root, 'src', 'data', 'town_chunks.json'), output, 'utf8');
  console.log(`Generated ${chunks.length} PropVerse Town chunks.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
