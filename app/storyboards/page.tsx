import styles from "./storyboards.module.css";

const packFlow = ["Lobby", "Choose", "Tear", "Reveal"];

function FlowStrip({ accent, steps = packFlow }: { accent: "riot" | "case" | "broadcast" | "hybrid"; steps?: string[] }) {
  return (
    <div className={`${styles.flowStrip} ${styles[`${accent}Flow`]}`} aria-label="Pack-opening flow">
      {steps.map((step, index) => (
        <div key={step} className={styles.flowStep}>
          <span>0{index + 1}</span>
          <b>{step}</b>
          <i aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

function ChromeDots() {
  return <div className={styles.chromeDots} aria-hidden="true"><i /><i /><i /></div>;
}

type IconName = "pack" | "games" | "cards" | "wallet";

function UiIcon({ name }: { name: IconName }) {
  if (name === "pack") return <svg className={styles.uiIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12l1 4v14H5V7l1-4Z" /><path d="M5 7h14M9 11h6" /></svg>;
  if (name === "games") return <svg className={styles.uiIcon} viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1" /><circle cx="16" cy="8" r="1" /><circle cx="8" cy="16" r="1" /><circle cx="16" cy="16" r="1" /></svg>;
  if (name === "cards") return <svg className={styles.uiIcon} viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="13" height="17" rx="2" /><path d="m10 8 2-2 3 3-5 5-2-2" /><path d="M4 7v13a2 2 0 0 0 2 2h9" /></svg>;
  return <svg className={styles.uiIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a3 3 0 0 1 3-3h12v16H6a3 3 0 0 1-3-3V7Z" /><path d="M15 10h6v5h-6a2.5 2.5 0 0 1 0-5Z" /></svg>;
}

function MobileIconDock({ active = "pack", className = "" }: { active?: IconName; className?: string }) {
  const items: { name: IconName; label: string }[] = [
    { name: "pack", label: "Packs" },
    { name: "games", label: "Games" },
    { name: "cards", label: "Collection" },
    { name: "wallet", label: "Wallet" },
  ];
  return (
    <nav className={`${styles.iconDock} ${className}`} aria-label="Mobile concept navigation">
      {items.map((item) => <button className={item.name === active ? styles.iconDockActive : ""} type="button" aria-label={item.label} key={item.name}><UiIcon name={item.name} /></button>)}
    </nav>
  );
}

function RiotBoard() {
  return (
    <section className={`${styles.option} ${styles.riot}`} id="manga-riot">
      <div className={styles.optionIntro}>
        <div><span className={styles.optionNumber}>01</span><span className={styles.eyebrow}>Graphic / kinetic / loud</span></div>
        <h2>MANGA<br /><em>RIOT</em></h2>
        <p>Ink-heavy manga panels meet a 2000s rhythm-game menu. Fast cuts, halftone flashes, oversized type, and sharp card silhouettes make every hit feel like a splash page.</p>
        <div className={styles.palette} aria-label="Palette"><i /><i /><i /><i /></div>
        <dl><div><dt>Best at</dt><dd>Games and high-energy openings</dd></div><div><dt>Motion</dt><dd>Panel slams, speed lines, snap reveals</dd></div></dl>
      </div>

      <div className={styles.boardColumn}>
        <div className={`${styles.desktopFrame} ${styles.riotDesktop}`}>
          <div className={styles.browserBar}><ChromeDots /><span>ARCANA CARDS // ISSUE 006</span><b>¥ 28.40</b></div>
          <nav className={styles.riotRail} aria-label="Concept navigation">
            <strong>AC</strong>
            <button className={styles.railActive} type="button" aria-label="Open packs">壱</button>
            <button type="button" aria-label="Play games">弐</button>
            <button type="button" aria-label="Open collection">参</button>
            <small>SPINE 06</small>
          </nav>
          <div className={styles.riotCanvas}>
            <div className={styles.riotHeadline}><small>SELECT YOUR POISON</small><b>PACK<br />DROP</b><em>!</em></div>
            <div className={styles.riotTabs}>
              <button type="button"><i>01</i><b>PACKS</b><small>RIP</small></button>
              <button type="button"><i>02</i><b>GAMES</b><small>BET</small></button>
              <button type="button"><i>03</i><b>VAULT</b><small>KEEP</small></button>
            </div>
            <img className={styles.riotGirl} src="/heartlock/cutouts/jolyne-kujo.webp" alt="Jolyne character cutout" />
            <div className={styles.riotPack}>
              <div className={styles.riotPackFan}>
                <img src="/card-data/images/sets/NS-05-M01/ns-05-m01.jpg" alt="Alternate booster" />
                <img src="/card-data/images/sets/NS-05-M06/ns-05-m06.jpg" alt="NS-05-M06 booster display" />
                <img src="/card-data/images/sets/NS-05-M09/ns-05-m09.jpg" alt="Alternate booster" />
              </div>
              <div><small>FIVE YUAN / 08 CARDS</small><b>NS-05-M06</b><span>DRAG TO CHOOSE</span></div>
              <button className={styles.riotRip} type="button" aria-label="Rip selected pack"><span>RIP</span><b>¥5</b><i>➜</i></button>
            </div>
            <div className={styles.riotTicker}>JOLYNE ★ ZR ★ ¥175.00 &nbsp; / &nbsp; NEXT BOX IN 08</div>
            <div className={styles.riotBurst}>NEW<br />HIT</div>
            <div className={styles.riotSfx} aria-hidden="true">ズ<br />キ<br />ュ<br />ン</div>
          </div>
        </div>

        <div className={styles.mobileRow}>
          <div className={`${styles.phoneFrame} ${styles.riotPhone}`}>
            <div className={styles.phoneStatus}><span>9:41</span><b>¥28.40</b></div>
            <div className={styles.phoneTitle}>PACK<br /><em>DROP!</em></div>
            <img className={styles.phoneGirlRiot} src="/heartlock/cutouts/jolyne-kujo.webp" alt="" />
            <div className={styles.phonePackRiot}><img src="/card-data/images/sets/NS-05-M06/ns-05-m06.jpg" alt="Selected pack" /><b>NS-05-M06</b></div>
            <MobileIconDock className={styles.riotIconDock} />
          </div>
          <FlowStrip accent="riot" />
        </div>
      </div>
    </section>
  );
}

const caseDrops = [
  { src: "/card-data/images/cards/NS-10-M03/MR-027.webp", rarity: "MR", value: "¥210" },
  { src: "/card-data/images/cards/NS-05-M01/SSR-060.webp", rarity: "SSR", value: "¥18" },
  { src: "/card-data/images/cards/NS-05-M09/XR-005.webp", rarity: "XR", value: "¥95" },
  { src: "/card-data/images/cards/NS-05-M06/ZR-008.webp", rarity: "ZR", value: "¥175" },
  { src: "/card-data/images/cards/NS-05-M05/XR-114.webp", rarity: "XR", value: "¥68" },
  { src: "/card-data/images/cards/NS-07/SSR-017.webp", rarity: "SSR", value: "¥22" },
];

function CaseBoard() {
  return (
    <section className={`${styles.option} ${styles.caseDrop}`} id="case-drop">
      <div className={styles.optionIntro}>
        <div><span className={styles.optionNumber}>02</span><span className={styles.eyebrow}>Tense / collectible / decisive</span></div>
        <h2>CASE<br /><em>DROP</em></h2>
        <p>A case-opening room built around one addictive moment: the reel slows, the center blade locks, and the winning card tears forward. Anime operators and live market values make it ours.</p>
        <div className={styles.palette} aria-label="Palette"><i /><i /><i /><i /></div>
        <dl><div><dt>Best at</dt><dd>Pack suspense and the value economy</dd></div><div><dt>Motion</dt><dd>Reel velocity, magnetic lock, prize slam</dd></div></dl>
      </div>

      <div className={styles.boardColumn}>
        <div className={`${styles.desktopFrame} ${styles.caseDesktop}`}>
          <header className={styles.caseHeader}>
            <div><b>A//D</b><span>CLASSIFIED // CONTRACT 05</span></div>
            <nav><span className={styles.caseNavActive}><i>01</i>CASES</span><span><i>02</i>ARCADE</span><span><i>03</i>MARKET</span><span><i>04</i>VAULT</span></nav>
            <strong><small>BALANCE</small>¥ 28.40</strong>
          </header>
          <div className={styles.caseStatus}><i /> LIVE DROPS <b>4,281</b></div>
          <img className={styles.caseGirl} src="/heartlock/cutouts/makima.webp" alt="Makima operator cutout" />
          <div className={styles.caseOperator}><small>YOUR OPERATOR</small><b>MAKIMA_03</b><span>“Let it stop on red.”</span></div>
          <div className={styles.caseStage}>
            <div className={styles.caseStageTitle}><span>FILE 05</span><b>DEVIL&apos;S CONTRACT</b><em>5 YUAN · 8 CARDS</em></div>
            <div className={styles.caseReel}>
              <i className={styles.caseNeedle} aria-hidden="true" />
              <div className={styles.caseTrack}>
                {caseDrops.map((drop, index) => (
                  <div className={`${styles.caseCard} ${index === 3 ? styles.caseCardWinner : ""}`} key={`${drop.rarity}-${index}`}>
                    <img src={drop.src} alt={`${drop.rarity} possible card drop`} />
                    <span>{drop.rarity}</span><b>{drop.value}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.caseOdds}><span><i /> COMMON 58%</span><span><i /> RARE 31%</span><span><i /> MYTHIC 11%</span></div>
            <div className={styles.caseControls}>
              <span><i>✓</i> VERIFIED SEED 8F23</span>
              <button type="button" aria-label="Break the case seal for five yuan"><i /><span>BREAK<br />SEAL</span><b>¥5</b></button>
            </div>
          </div>
          <div className={styles.caseFeed}><small>RECENT</small><span><b>JOLYNE ZR</b> ¥175</span><span><b>MAKIMA MR</b> ¥210</span></div>
        </div>

        <div className={styles.mobileRow}>
          <div className={`${styles.phoneFrame} ${styles.casePhone}`}>
            <div className={styles.casePhoneTop}><b>A//D</b><span>¥28.40</span></div>
            <img className={styles.phoneGirlCase} src="/heartlock/cutouts/makima.webp" alt="" />
            <div className={styles.casePhoneName}><small>CASE 05</small><b>DEVIL&apos;S<br />CONTRACT</b></div>
            <div className={styles.casePhoneReel}>
              <i aria-hidden="true" />
              {caseDrops.slice(1, 5).map((drop, index) => <img className={index === 2 ? styles.casePhoneWinner : ""} src={drop.src} alt="" key={`phone-${drop.rarity}-${index}`} />)}
            </div>
            <div className={styles.casePhonePull}><span>SWIPE TO SPIN</span><b>›</b></div>
            <div className={styles.casePhoneDock}><span>CASES</span><span>PLAY</span><span>VAULT</span></div>
          </div>
          <FlowStrip accent="case" steps={["Case", "Spin", "Lock", "Drop"]} />
        </div>
      </div>
    </section>
  );
}

function HybridBoard() {
  return (
    <section className={`${styles.option} ${styles.hybrid}`} id="case-riot">
      <div className={styles.optionIntro}>
        <div><span className={styles.optionNumber}>03</span><span className={styles.eyebrow}>Manga energy / case-opening tension</span></div>
        <h2>CASE<br /><em>RIOT</em></h2>
        <p>The expressive character, ink, and crooked panels of Manga Riot wrapped around Case Drop&apos;s reel and value mechanics. It feels like tearing open a forbidden manga issue.</p>
        <div className={styles.palette} aria-label="Palette"><i /><i /><i /><i /></div>
        <dl><div><dt>Best at</dt><dd>A final direction with both attitude and clarity</dd></div><div><dt>Motion</dt><dd>Panel cuts, reel inertia, ink-burst hits</dd></div></dl>
      </div>

      <div className={styles.boardColumn}>
        <div className={`${styles.desktopFrame} ${styles.hybridDesktop}`}>
          <header className={styles.hybridHeader}>
            <b>CR<span>!</span></b>
            <div><small>ISSUE</small><strong>006</strong></div>
            <nav aria-label="Hybrid concept modes"><button type="button"><UiIcon name="pack" /><span>PACKS</span></button><button type="button"><UiIcon name="games" /><span>GAMES</span></button><button type="button"><UiIcon name="cards" /><span>VAULT</span></button></nav>
            <em>¥28.40</em>
          </header>
          <div className={styles.hybridInk} aria-hidden="true" />
          <img className={styles.hybridGirl} src="/heartlock/cutouts/jolyne-kujo.webp" alt="Jolyne character cutout" />
          <div className={styles.hybridTitle}><small>CONTRABAND CASE 05</small><b>DEVIL&apos;S<br /><i>DROP!</i></b><span>8 CARDS · ONE GUARANTEED SR+</span></div>
          <div className={styles.hybridReel}>
            <div className={styles.hybridPointer}><span>HIT</span></div>
            <div className={styles.hybridTrack}>
              {caseDrops.map((drop, index) => (
                <div className={`${styles.hybridCard} ${index === 3 ? styles.hybridWinner : ""}`} key={`hybrid-${drop.rarity}-${index}`}>
                  <img src={drop.src} alt={`${drop.rarity} possible drop`} /><span>{drop.rarity}</span><b>{drop.value}</b>
                </div>
              ))}
            </div>
          </div>
          <button className={styles.hybridRip} type="button" aria-label="Rip case for five yuan"><span>RIP THE CASE</span><b>¥5</b><i>➜</i></button>
          <div className={styles.hybridOdds}><span>R 58%</span><span>SR 25%</span><span>SSR 11%</span><span>MYTHIC 6%</span></div>
          <div className={styles.hybridTicker}><b>★ LIVE HIT</b><span>JOLYNE ZR · ¥175</span><em>SEED VERIFIED</em></div>
        </div>

        <div className={styles.mobileRow}>
          <div className={`${styles.phoneFrame} ${styles.hybridPhone}`}>
            <div className={styles.hybridPhoneTop}><b>CR!</b><span>ISSUE 006</span><strong>¥28.40</strong></div>
            <img className={styles.phoneGirlHybrid} src="/heartlock/cutouts/jolyne-kujo.webp" alt="" />
            <div className={styles.hybridPhoneTitle}><small>CASE 05</small><b>DEVIL&apos;S<br /><i>DROP!</i></b></div>
            <div className={styles.hybridPhoneReel}>
              <i aria-hidden="true" />
              {caseDrops.slice(1, 5).map((drop, index) => <img className={index === 2 ? styles.hybridPhoneWinner : ""} src={drop.src} alt="" key={`hybrid-phone-${drop.rarity}-${index}`} />)}
            </div>
            <button className={styles.hybridPhoneRip} type="button"><span>RIP</span><b>¥5</b><i>➜</i></button>
            <MobileIconDock className={styles.hybridIconDock} />
          </div>
          <FlowStrip accent="hybrid" steps={["Choose", "Rip", "Spin", "Hit"]} />
        </div>
      </div>
    </section>
  );
}

export default function Storyboards() {
  return (
    <main className={styles.storyboardPage}>
      <header className={styles.boardHeader}>
        <div><b>ARCANA CARDS</b><span>UI direction boards</span></div>
        <nav aria-label="Storyboard options">
          <a href="#manga-riot"><i>01</i> Manga Riot</a>
          <a href="#case-drop"><i>02</i> Case Drop</a>
          <a href="#case-riot"><i>03</i> Case Riot</a>
        </nav>
        <small>LOCAL CONCEPTS</small>
      </header>
      <RiotBoard />
      <CaseBoard />
      <HybridBoard />
      <footer className={styles.boardFooter}><b>Pick 01, 02, or 03.</b><span>The games, economy, collection, and pack logic stay intact.</span></footer>
    </main>
  );
}
