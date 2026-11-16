import villaData from "@/data/villas.json";
import type {
  InventoryApartment,
  InventoryFacing,
  InventoryStatus,
} from "@/types/inventory";

export type VillaPosition = "center" | "corner";

export type VillaType = (typeof villaData.types)[number];
export type VillaRecord = (typeof villaData.villas)[number];

export type VillaCatalogEntry = VillaRecord & {
  details: VillaType;
};

const villaTypesById = new Map(
  villaData.types.map((villaType) => [villaType.id, villaType]),
);

export const villaCatalog: VillaCatalogEntry[] = villaData.villas.map(
  (villa) => {
    const details = villaTypesById.get(villa.typeId);

    if (!details) {
      throw new Error(
        `Villa ${villa.villaNumber} references unknown type ${villa.typeId}.`,
      );
    }

    return { ...villa, details };
  },
);

export const villaTypes = villaData.types;

export function getVillaInventoryApartments(): InventoryApartment[] {
  return villaCatalog.map((villa) => {
    const number = String(villa.villaNumber).padStart(2, "0");
    const { details } = villa;

    return {
      id: `villa-${number}`,
      unitKey: `villa-${number}`,
      title: `Villa ${number}`,
      flatNumber: number,
      tower: "Tower A",
      bhk: details.bedrooms,
      unitType: details.id,
      priceLakhs: 0,
      areaSqft: details.advertisedBuiltUpSqFt,
      carpetAreaSqft: details.plotAreaSqYd,
      balconyAreaSqft: villa.roadFrontages,
      floor: 0,
      floorLabel: "G+2",
      floorRange: villa.position,
      facing: details.facing as InventoryFacing,
      status: villaData.availability.default as InventoryStatus,
      roomDimensions: `${details.plotDimensionsM.width}m × ${details.plotDimensionsM.depth}m plot`,
      floorPlanId: villa.position,
      floorPlanImage: villa.image,
      floorPlanR2Key: "",
      floorPlanSourcePath: villa.image,
    };
  });
}

export function getVillaTypeLabel(typeId: string) {
  return villaTypesById.get(typeId)?.label ?? typeId;
}

export function getVillaTypeName(typeId: string) {
  return villaTypesById.get(typeId)?.type ?? typeId;
}
