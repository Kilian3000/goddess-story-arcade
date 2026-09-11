"use client";

import { useEffect, useState } from "react";
import { arcadeConfig } from "./arcade-config";
import type { Card, CardDatabase, SetRecord } from "./card-types";
import type { PackConfig } from "./gacha-engine";

type PackCatalog = { packs: PackConfig[] };

declare global {
  interface Window { CARD_LISTER_DB?: CardDatabase }
}

const DATABASE_URL = arcadeConfig.cardDatabaseUrl;
const CATALOG_URL = "/pack-configs.json";

export function useCardCatalog() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [catalog, setCatalog] = useState<PackConfig[]>([]);
  const [dbStatus, setDbStatus] = useState<"loading" | "ready" | "error">("loading");
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch(CATALOG_URL)
      .then((response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json() as Promise<PackCatalog>;
      })
      .then((data) => {
        setCatalog(data.packs);
        setCatalogStatus("ready");
      })
      .catch(() => setCatalogStatus("error"));

    const acceptDatabase = () => {
      const database = window.CARD_LISTER_DB;
      if (!database?.cards?.length || !database?.sets?.length) return false;
      setAllCards(database.cards.filter((card) => !card.image_missing && Boolean(card.image_path)));
      setSets(database.sets);
      setDbStatus("ready");
      return true;
    };

    if (acceptDatabase()) return;
    let script = document.querySelector<HTMLScriptElement>(`script[src="${DATABASE_URL}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = DATABASE_URL;
      script.async = true;
      document.head.appendChild(script);
    }
    const onLoad = () => { if (!acceptDatabase()) setDbStatus("error"); };
    const onError = () => setDbStatus("error");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, []);

  return {
    allCards,
    sets,
    catalog,
    dbStatus,
    catalogStatus,
    catalogReady: dbStatus === "ready" && catalogStatus === "ready",
  };
}
