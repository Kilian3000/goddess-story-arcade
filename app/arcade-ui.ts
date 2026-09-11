export const groupLabels: Record<string, string> = {
  "1 юань": "1 Yuan",
  "2 юаня": "2 Yuan",
  "5 юаней": "5 Yuan",
  "10 юаней": "10 Yuan",
  "Суприм": "Supreme",
};

export const rarityColors: Record<string, string> = {
  R: "#9895a0", SR: "#c8c5d0", CR: "#68ddef", FR: "#ff8dc9", SCR: "#ac88ff",
  SSR: "#ffd36e", SER: "#ff778d", GR: "#7df0b3", PTR: "#5de9ff", PR: "#f2d36b",
  MR: "#ff5da4", ZR: "#bf78ff", XR: "#ff71d0", SP: "#ff8a63", BW: "#ffffff",
  RDM: "#ff3d6d", INS: "#67ead1", BHR: "#f6a05c", SD: "#73adff", SSD: "#b77dff",
  SZR: "#ff59d8", UR: "#ff955e", ACR: "#ff7cbd", HR: "#7ce4ff", MTL: "#e4b871",
  WTR: "#7de9d4", TGR: "#ed8c60", TR: "#ff9880", LSP: "#e7d8ff", JNH: "#f2b4de",
};

export function rarityColor(rarity: string) {
  return rarityColors[rarity] || "#b18aff";
}

export function groupClass(group?: string) {
  if (group === "1 юань") return "tier-one";
  if (group === "2 юаня") return "tier-two";
  if (group === "5 юаней") return "tier-five";
  if (group === "10 юаней") return "tier-ten";
  return "tier-supreme";
}
