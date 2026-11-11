"""
Pixelcake Backend - FastAPI Application
Main entry point for the API server
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os

from app.database import engine
from app.admin import setup_admin
from app.admin.health import get_all_health
from app.routers import projects, canvases, templates

# API Description with Markdown
API_DESCRIPTION = """
## 🍰 PixelCake API

Servizio di salvataggio di PixelCake, il designer visuale per piccole reti.
Conserva progetti, tavole e modelli. Il controllo di raggiungibilità e il
terminale girano nel browser e non passano da qui.

### Quick Links
- 🖥️ [Frontend App](http://localhost:5173) - Visual Designer
- ⌨️ [Terminal — NCL Reference](/docs/terminal) - Network Command Language v0.1
- 🔧 [Admin Panel](/admin) - Database Management
- 📊 [Health Dashboard](/dashboard) - System Monitoring
- 📚 [ReDoc](/redoc) - Alternative API Docs

### ⌨️ NCL — Network Command Language
Il terminale integrato nel designer parla **NCL v0.1**: un linguaggio vendor-neutral
in inglese semi-naturale per diagnostica (`ping`, `trace`), ispezione
(`show devices | interfaces | ip …`) e configurazione della topologia
(`set`, `add vlan`, `connect`, `interface <n> up|down`).
La reference completa del linguaggio è su [/docs/terminal](/docs/terminal).

### API Endpoints
I principali gruppi di endpoint sono:
- **Projects**: Gestione progetti e metadati
- **Canvases**: Topologie di rete (dispositivi, connessioni)
- **Templates**: Template dispositivi e connessioni
"""

# OpenAPI Tags for grouping endpoints
OPENAPI_TAGS = [
    {
        "name": "projects",
        "description": "Operazioni sui **progetti**. Ogni progetto contiene uno o più canvas.",
    },
    {
        "name": "canvases",
        "description": "Operazioni sui **canvas**. Ogni canvas contiene dispositivi e connessioni.",
    },
    {
        "name": "templates",
        "description": "**Template** per dispositivi e connessioni (globali e custom).",
    },
]

app = FastAPI(
    title="🍰 Pixelcake API",
    description=API_DESCRIPTION,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=OPENAPI_TAGS,
    contact={
        "name": "Pixelcake Team",
        "url": "https://github.com/pixelcake-dev/pixelcake",
    },
    license_info={
        "name": "AGPL-3.0-only",
        "url": "https://www.gnu.org/licenses/agpl-3.0.html",
    },
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (logo, favicon)
static_path = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

# Setup SQLAdmin panel on /admin route
admin = setup_admin(app, engine)

# Register API routers
app.include_router(projects.router, prefix="/api", tags=["projects"])
app.include_router(canvases.router, prefix="/api", tags=["canvases"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def landing_page():
    """
    Landing page with links to all services
    """
    return """
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pixelcake API</title>
    <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
        }
        .logo {
            width: 120px;
            height: auto;
            margin-bottom: 1.5rem;
            filter: drop-shadow(0 0 20px rgba(255,255,255,0.2));
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(90deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .subtitle {
            color: #a0aec0;
            margin-bottom: 2rem;
            font-size: 1.1rem;
        }
        .version {
            display: inline-block;
            background: rgba(102, 126, 234, 0.2);
            color: #667eea;
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            margin-bottom: 2rem;
        }
        .links {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            justify-content: center;
            margin-bottom: 2rem;
        }
        .link-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1.25rem 1.5rem;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            text-decoration: none;
            color: #fff;
            transition: all 0.3s ease;
            min-width: 140px;
        }
        .link-card:hover {
            background: rgba(255,255,255,0.1);
            transform: translateY(-4px);
            box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
        }
        .link-card .icon { font-size: 1.5rem; margin-bottom: 0.5rem; }
        .link-card .label { font-weight: 500; }
        .link-card .desc { font-size: 0.75rem; color: #a0aec0; margin-top: 0.25rem; }
        .link-card.primary { background: linear-gradient(135deg, #667eea, #764ba2); border: none; }
        .link-card.primary:hover { box-shadow: 0 10px 40px rgba(102, 126, 234, 0.5); }
        .footer {
            color: #4a5568;
            font-size: 0.85rem;
        }
        .footer a { color: #667eea; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }
        .status {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(72, 187, 120, 0.1);
            color: #48bb78;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            margin-bottom: 2rem;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            background: #48bb78;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="/static/logo.svg" alt="Pixelcake Logo" class="logo">
        <h1>🍰 Pixelcake API</h1>
        <p class="subtitle">Storage service for the PixelCake network designer</p>
        <span class="version">v0.1.0</span>

        <div class="status">
            <span class="status-dot"></span>
            API Online
        </div>

        <div class="links">
            <a href="/docs" class="link-card primary">
                <span class="icon">📖</span>
                <span class="label">API Docs</span>
                <span class="desc">Swagger UI</span>
            </a>
            <a href="/redoc" class="link-card">
                <span class="icon">📚</span>
                <span class="label">ReDoc</span>
                <span class="desc">Alternative Docs</span>
            </a>
            <a href="/admin" class="link-card">
                <span class="icon">🔧</span>
                <span class="label">Admin</span>
                <span class="desc">Database Panel</span>
            </a>
            <a href="/dashboard" class="link-card">
                <span class="icon">📊</span>
                <span class="label">Dashboard</span>
                <span class="desc">Health Monitor</span>
            </a>
            <a href="/docs/terminal" class="link-card">
                <span class="icon">⌨️</span>
                <span class="label">Terminal</span>
                <span class="desc">NCL Reference</span>
            </a>
            <a href="http://localhost:5173" class="link-card" target="_blank">
                <span class="icon">🖥️</span>
                <span class="label">Frontend</span>
                <span class="desc">Visual Designer</span>
            </a>
        </div>

        <p class="footer">
            Built with ❤️ using FastAPI •
            <a href="https://github.com/pixelcake-dev/pixelcake" target="_blank">GitHub</a>
        </p>
    </div>
</body>
</html>
    """


# ─────────────────────────────────────────────────────────────────────────────
# NCL — Network Command Language v0.1 — complete reference (/docs/terminal)
# Spec source: docs/terminal-commands.md (repo root). Prose in Italian,
# commands/output in English — matching the product terminal.
# ─────────────────────────────────────────────────────────────────────────────

NCL_REFERENCE_HTML = """
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NCL — Network Command Language v0.1</title>
    <link rel="icon" type="image/svg+xml" href="/static/favicon.svg">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            background-attachment: fixed;
            min-height: 100vh;
            color: #e2e8f0;
            line-height: 1.65;
        }
        .page { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
        .topnav { margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
        .topnav a { color: #667eea; text-decoration: none; font-size: 0.9rem; }
        .topnav a:hover { text-decoration: underline; }
        header h1 {
            font-size: 2.3rem;
            line-height: 1.2;
            background: linear-gradient(90deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.75rem;
        }
        .version {
            display: inline-block;
            background: rgba(102, 126, 234, 0.2);
            color: #8da2f5;
            padding: 0.2rem 0.75rem;
            border-radius: 20px;
            font-size: 0.85rem;
            margin-bottom: 1rem;
        }
        .tagline { color: #a0aec0; font-size: 1.05rem; max-width: 48rem; }
        section { margin-top: 2.5rem; }
        .card {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.09);
            border-radius: 12px;
            padding: 1.5rem 1.75rem;
        }
        h2 {
            font-size: 1.45rem;
            color: #fff;
            border-left: 4px solid #667eea;
            padding-left: 0.75rem;
            margin-bottom: 1rem;
        }
        h3 { font-size: 1.02rem; color: #93c5fd; margin: 1.4rem 0 0.5rem; }
        p { color: #c3cbd9; margin-bottom: 0.75rem; }
        ul, ol { color: #c3cbd9; margin: 0 0 0.75rem 1.4rem; }
        li { margin-bottom: 0.35rem; }
        strong { color: #e8edf5; }
        code {
            font-family: 'Cascadia Code', 'Fira Code', Consolas, Menlo, monospace;
            font-size: 0.85em;
            background: rgba(102,126,234,0.14);
            color: #c3d0f5;
            padding: 0.1rem 0.4rem;
            border-radius: 4px;
        }
        pre.console, pre.grammar {
            font-family: 'Cascadia Code', 'Fira Code', Consolas, Menlo, monospace;
            font-size: 0.83rem;
            line-height: 1.6;
            border-radius: 8px;
            padding: 1rem 1.25rem;
            margin: 0.75rem 0 1.1rem;
            overflow-x: auto;
            white-space: pre;
        }
        pre.console {
            background: #0a0f1e;
            border: 1px solid rgba(255,255,255,0.09);
            color: #d7dde7;
        }
        pre.grammar {
            background: rgba(102,126,234,0.07);
            border: 1px solid rgba(102,126,234,0.25);
            color: #c9d4f0;
        }
        .console .p  { color: #48bb78; font-weight: 600; }  /* prompt */
        .console .c  { color: #f0f4fa; }                    /* typed command */
        .console .ok { color: #4ade80; }
        .console .er { color: #f87171; }
        .console .mu { color: #718096; }
        .console .hd { color: #93c5fd; }
        .tbl { overflow-x: auto; margin: 0.75rem 0 1.1rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        th, td {
            text-align: left;
            padding: 0.5rem 0.75rem;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            vertical-align: top;
        }
        th { color: #93c5fd; font-weight: 600; white-space: nowrap; }
        td:first-child { white-space: nowrap; }
        .badge {
            display: inline-block;
            font-size: 0.68rem;
            padding: 0.1rem 0.5rem;
            border-radius: 10px;
            vertical-align: middle;
            margin-left: 0.4rem;
            letter-spacing: 0.03em;
        }
        .badge.canon { background: rgba(72,187,120,0.15); color: #48bb78; }
        .badge.alias { background: rgba(102,126,234,0.18); color: #8da2f5; }
        .note {
            background: rgba(102,126,234,0.1);
            border-left: 3px solid #667eea;
            border-radius: 0 8px 8px 0;
            padding: 0.75rem 1rem;
            margin: 0.75rem 0 1.1rem;
            color: #b8c4e0;
            font-size: 0.92rem;
        }
        .warn {
            background: rgba(248,113,113,0.08);
            border-left: 3px solid #f87171;
            border-radius: 0 8px 8px 0;
            padding: 0.75rem 1rem;
            margin: 0.75rem 0 1.1rem;
            color: #e5b8b8;
            font-size: 0.92rem;
        }
        .toc-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
            gap: 0.4rem 1.5rem;
            counter-reset: toc;
        }
        .toc-grid a {
            color: #a9b8e8;
            text-decoration: none;
            font-size: 0.92rem;
            padding: 0.25rem 0;
            display: block;
        }
        .toc-grid a::before {
            counter-increment: toc;
            content: counter(toc) ". ";
            color: #667eea;
            font-weight: 600;
        }
        .toc-grid a:hover { color: #fff; }
        footer {
            margin-top: 3.5rem;
            color: #4a5568;
            font-size: 0.85rem;
            text-align: center;
        }
        footer a { color: #667eea; text-decoration: none; }
        footer a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="page">
        <nav class="topnav">
            <a href="/">← Pixelcake API</a>
            <a href="/docs">Swagger UI →</a>
        </nav>

        <header>
            <h1>NCL — Network Command Language</h1>
            <span class="version">v0.1 — spec aperta, vendor-neutral</span>
            <p class="tagline">
                Un linguaggio vendor-neutral per apparati di rete, in inglese semi-naturale.
                Cisco, Juniper e Mikrotik parlano dialetti proprietari; <strong>NCL è
                l'esperanto</strong>: uno standard aperto e trasversale con cui descrivere
                diagnostica, ispezione e configurazione di una rete — indipendentemente
                da chi ha costruito gli apparati. Questa pagina è la reference completa
                della versione 0.1, il linguaggio del terminale integrato di PixelCake.
            </p>
        </header>

        <section class="card" id="indice">
            <h2>Indice</h2>
            <nav class="toc-grid">
                <a href="#filosofia">Filosofia e principi</a>
                <a href="#sintassi">Sintassi generale</a>
                <a href="#diagnostica">Diagnostica — ping e trace</a>
                <a href="#ispezione">Ispezione — show</a>
                <a href="#configurazione">Configurazione</a>
                <a href="#sessione">Sessione e contesto</a>
                <a href="#flussi">Email e flussi</a>
                <a href="#convenzioni">Convenzioni e tolleranze</a>
                <a href="#roadmap">Roadmap del linguaggio</a>
            </nav>
        </section>

        <!-- ═══════════════════════ 1. FILOSOFIA ═══════════════════════ -->
        <section class="card" id="filosofia">
            <h2>1. Filosofia e principi</h2>
            <p>
                NCL nasce da un'osservazione semplice: i comandi di rete esprimono sempre
                le stesse idee — <em>raggiungibilità, stato, appartenenza, collegamento</em> —
                ma ogni vendor le traveste con una sintassi diversa. NCL le esprime una
                volta sola, in inglese piano, e lascia al motore il compito di valutare
                la topologia reale.
            </p>
            <ol>
                <li><strong>Verb-first.</strong> Ogni comando inizia con un verbo:
                    <code>ping</code>, <code>trace</code>, <code>show</code>,
                    <code>set</code>, <code>connect</code>, <code>use</code>…
                    Il verbo determina la grammatica del resto della riga.</li>
                <li><strong>Preposizioni opzionali.</strong> <code>of</code>, <code>to</code>,
                    gli articoli <code>the</code>/<code>a</code> e le parole
                    <code>device</code>/<code>host</code> sono rumore ammesso:
                    <code>show config of Switch-0</code> ≡ <code>show config Switch-0</code>.</li>
                <li><strong>Contesto dispositivo.</strong> <code>use &lt;device&gt;</code> apre
                    una sessione sul dispositivo (il prompt diventa <code>PC-1&gt;</code>):
                    da lì <code>from</code> è implicito e i comandi <code>show</code>
                    senza argomento si riferiscono al contesto. <code>exit</code> chiude.</li>
                <li><strong>Vocabolario vendor-neutral.</strong> <code>show neighbors</code>,
                    non <code>show cdp neighbors</code>; <code>interface 3 down</code>,
                    non <code>no shutdown</code>. Il termine unificante è
                    <code>interfaces</code>: porte fisiche e NIC in un'unica tabella.</li>
                <li><strong>Le tolleranze sono parte della spec</strong>, non zucchero del
                    parser: nomi multi-parola delimitati dalle keyword di ruolo
                    (<code>from</code>/<code>to</code>/<code>of</code>/<code>on</code>),
                    nomi tra virgolette, case-insensitive ovunque, indirizzi IP accettati
                    ovunque sia atteso un dispositivo, «did you mean…?» su verbi e
                    dispositivi sconosciuti. Un'implementazione conforme le supporta tutte
                    (v. <a href="#convenzioni" style="color:#8da2f5">§8</a>).</li>
                <li><strong>Il motore valuta, non anima soltanto.</strong> <code>ping</code> e
                    <code>trace</code> sono giudizi reali sulla topologia (VLAN, subnet,
                    gateway, zone firewall, port binding), animati sul canvas hop per hop —
                    l'output del terminale segue il pacchetto in tempo reale.</li>
            </ol>
        </section>

        <!-- ═══════════════════════ 2. SINTASSI ═══════════════════════ -->
        <section class="card" id="sintassi">
            <h2>2. Sintassi generale</h2>
            <p>
                La grammatica di NCL v0.1 in forma EBNF semplificata. Le parentesi quadre
                indicano parti opzionali, la barra alternative; i terminali sono tra
                virgolette.
            </p>
            <pre class="grammar">command       ::= diagnostic | inspection | configuration | session

diagnostic    ::= ("ping" | "trace") target ["from" device]
inspection    ::= "show" show-target [["of"] device]
show-target   ::= "devices" | "interfaces" | "ports" | "vlans"
                | "connections" | "config" | "neighbors" | "ip"

configuration ::= set-cmd | vlan-cmd | link-cmd | iface-cmd
set-cmd       ::= "set" ("ip" | "gateway" | "subnet" | "name")
                        ["of"] device ["to"] value
vlan-cmd      ::= "add" "vlan" number ["to"] device
                | "remove" "vlan" number "from" device
link-cmd      ::= "connect" device ["to"] device
                | "disconnect" device ["from"] device
iface-cmd     ::= "interface" number ("up" | "down") ["on"] device

session       ::= "use" device | "exit" | "clear" | "help" [topic]

target        ::= device | ipv4
device        ::= word { word } | '"' text '"'      (* multi-parola, quotabile *)</pre>
            <ul>
                <li>Tutto è <strong>case-insensitive</strong>: <code>PING WEB-01</code> ≡
                    <code>ping web-01</code>.</li>
                <li>In un contesto dispositivo (<code>use …</code>) le parti
                    <code>["from" device]</code> e <code>[["of"] device]</code> hanno come
                    default il dispositivo di contesto.</li>
                <li>Le keyword di ruolo <code>from</code>, <code>to</code>, <code>of</code>,
                    <code>on</code> delimitano i segmenti-nome: tutto ciò che sta fra due
                    keyword è un unico nome, anche con spazi.</li>
                <li>All'inizio di ogni segmento-nome il parser scarta articoli
                    (<code>the</code>, <code>a</code>) e sostantivi-rumore
                    (<code>device</code>, <code>host</code>). I nomi tra virgolette doppie
                    sono sempre letterali e mai interpretati come keyword.</li>
            </ul>
        </section>

        <!-- ═══════════════════════ 3. DIAGNOSTICA ═══════════════════════ -->
        <section class="card" id="diagnostica">
            <h2>3. Diagnostica — ping e trace</h2>
            <p>
                <code>ping &lt;target&gt; [from &lt;device&gt;]</code> e
                <code>trace &lt;target&gt; [from &lt;device&gt;]</code>
                (alias: <code>traceroute</code>, <code>tracert</code>) non sono animazioni
                di cortesia: il motore valuta la raggiungibilità sul cammino fisico più
                corto (BFS), hop per hop, fermandosi al primo blocco. Il pacchetto viaggia
                sul canvas e l'output del terminale lo segue in tempo reale.
            </p>

            <h3>Cosa valuta il motore, in ordine</h3>
            <ol>
                <li><strong>Endpoint validi</strong> — entrambi gli estremi devono esistere e
                    avere un IP primario valido → altrimenti verdetto <code>error</code>.</li>
                <li><strong>Percorso fisico</strong> — deve esistere un cammino di link →
                    altrimenti <code>unreachable</code>.</li>
                <li><strong>Port binding per link</strong> — se il link è agganciato a porte
                    fisiche e una delle due è <code>down</code>, il pacchetto è scartato →
                    <code>blocked</code>. I link senza binding saltano le regole per-porta
                    e lo dichiarano in una nota.</li>
                <li><strong>Continuità VLAN (L2)</strong> — su ogni switch di transito che
                    trasporta VLAN, le VLAN del traffico devono intersecare quelle del
                    dispositivo → altrimenti <code>blocked</code>.</li>
                <li><strong>Subnet e gateway (L3)</strong> — se sorgente e destinazione sono
                    in subnet diverse servono <em>due</em> cose: un default gateway
                    configurato sulla sorgente e <strong>almeno un router (o firewall) sul
                    percorso</strong> — il crossing di subnet richiede un dispositivo L3;
                    i soli switch non instradano → <code>blocked</code>.</li>
                <li><strong>Zone firewall</strong> — sugli hop firewall con link agganciati
                    alle porte, la transizione di security zone è valutata:
                    <code>untrust → trust</code>, <code>untrust → dmz</code> e
                    <code>dmz → trust</code> sono negate; le altre passano con nota.
                    Un firewall senza zone binding lascia passare, annotandolo.</li>
            </ol>

            <h3>ping — semantica di eco</h3>
            <p>
                <code>ping</code> valuta <strong>entrambe le direzioni</strong> (richiesta e
                risposta): configurazioni asimmetriche emergono subito. L'andata e il
                ritorno sono animati sul canvas; l'RTT simulato è deterministico
                (1&nbsp;ms + 2&nbsp;ms per hop intermedio).
            </p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">ping Web-01 from PC Sales 1</span>
<span class="mu">Pinging Web-01 (10.0.20.11) from PC-Sales-1...</span>
<span class="ok">Reply from 10.0.20.11: hops=4 time=5ms</span>
<span class="mu">  note: request: link PC-Sales-1–SW-Access-2 has no port binding: per-port rules skipped</span></pre>
            <p>Un ping bloccato riporta il verdetto, la ragione e il punto di drop:</p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">ping DB Primary from Guest-Laptop</span>
<span class="mu">Pinging DB-Primary (10.0.30.21) from Guest-Laptop...</span>
<span class="er">Ping failed (blocked): request: firewall policy on FW-1: untrust → trust denied</span>
<span class="mu">  dropped at: FW-1</span></pre>

            <h3>trace — hop-by-hop</h3>
            <p>
                <code>trace</code> è unidirezionale e stampa ogni hop con il suo verdetto
                man mano che il pacchetto lo raggiunge: <code>○</code> inoltrato,
                <code>●</code> consegnato, <code>✗</code> bloccato. Le note per-hop
                spiegano cosa è successo lì (routing tra subnet, policy firewall,
                traffico untagged…).
            </p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">trace DB Primary from PC Sales 1</span>
<span class="mu">Tracing route to DB-Primary (10.0.30.21) from PC-Sales-1:</span>
  1  ○ PC-Sales-1 (pc)
  2  ○ SW-Access-2 (switch)
  3  ○ Router-Core (router)  — routed between subnets
  4  ○ FW-1 (firewall)  — firewall policy: trust → dmz allowed
<span class="ok">  5  ● DB-Primary (database)</span>
<span class="ok">Trace complete: destination reached.</span></pre>
            <p>Un trace fallito mostra esattamente dove e perché il pacchetto muore:</p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">trace PC-2 from PC-1</span>
<span class="mu">Tracing route to PC-2 (192.168.2.10) from PC-1:</span>
  1  ○ PC-1 (pc)
<span class="er">  2  ✗ SW-1 (switch)  — no router between subnets 192.168.1.0 and 192.168.2.0 — L2 devices cannot route</span>
<span class="er">Trace failed (blocked): no router between subnets 192.168.1.0 and 192.168.2.0 — L2 devices cannot route</span></pre>

            <h3>Messaggi di errore tipici</h3>
            <div class="tbl"><table>
                <tr><th>Messaggio</th><th>Causa</th></tr>
                <tr><td><code>X has no IP address configured</code></td>
                    <td>Endpoint senza IP primario (verdetto <code>error</code>).</td></tr>
                <tr><td><code>no physical path between A and B</code></td>
                    <td>Nessun cammino di link (<code>unreachable</code>).</td></tr>
                <tr><td><code>port 3 on X is disabled</code></td>
                    <td>Il link attraversa una porta amministrativamente down.</td></tr>
                <tr><td><code>VLAN mismatch on X: traffic VLANs [10] not allowed (device carries [20])</code></td>
                    <td>Nessuna VLAN in comune sullo switch di transito.</td></tr>
                <tr><td><code>no default gateway configured on X</code></td>
                    <td>Traffico cross-subnet senza gateway sulla sorgente.</td></tr>
                <tr><td><code>no router between subnets 192.168.1.0 and 192.168.2.0
                    — L2 devices cannot route</code></td>
                    <td>Crossing di subnet senza alcun dispositivo L3 sul percorso.</td></tr>
                <tr><td><code>firewall policy on X: untrust → trust denied</code></td>
                    <td>Transizione di zona negata su un firewall con porte bound.</td></tr>
            </table></div>
        </section>

        <!-- ═══════════════════════ 4. ISPEZIONE ═══════════════════════ -->
        <section class="card" id="ispezione">
            <h2>4. Ispezione — show</h2>
            <p>
                Tutti i comandi di lettura passano da <code>show</code>
                (alias <code>sh</code>). Dove ha senso accettano
                <code>[of] &lt;device&gt;</code>; in contesto dispositivo l'argomento è
                implicito. <code>ls</code> e <code>list</code> sono alias di
                <code>show devices</code>; <code>ipconfig</code> e <code>ifconfig</code>
                di <code>show ip</code>.
            </p>

            <h3>show devices</h3>
            <p>Inventario del canvas: nome, tipo, IP primario, VLAN.</p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">show devices</span>
<span class="hd">DEVICE                   TYPE           IP               VLANS</span>
PC-Sales-1               pc             192.168.10.11    10
PC-Sales-2               pc             192.168.10.12    10
Core-Switch-HQ           switch         192.168.1.2      10,20,30
Router-Core              router         192.168.1.1      -
FW-1                     firewall       10.0.0.1         -
Web-01                   server         10.0.20.11       -
DB-Primary               database       10.0.30.21       -</pre>

            <h3>show interfaces [of] &lt;device&gt; <span class="badge canon">termine standard</span></h3>
            <p>
                <strong><code>interfaces</code> è IL termine unificato di NCL</strong>:
                porte fisiche (switch/router/firewall) e NIC (PC/server/database…) in
                un'unica tabella, qualunque sia la natura del dispositivo. È la vista da
                usare per default; <code>show ports</code> resta disponibile come vista
                specializzata delle sole porte.
            </p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">show interfaces of Core Switch HQ</span>
<span class="hd">INTERFACE    KIND   STATE  SPEED  VLAN        IP               ZONE</span>
port 1       port   up     1G     10          -                -
port 2       port   up     1G     20          -                -
<span class="mu">port 3       port   down   1G     -           -                -</span>
port 24      port   up     10G    10,20,30    -                trust

<span class="p">pixelcake&gt;</span> <span class="c">show interfaces of Web-01</span>
<span class="hd">INTERFACE    KIND   STATE  SPEED  VLAN        IP               ZONE</span>
eth0         nic    up     1G     -           10.0.20.11       -
eth1         nic    up     1G     -           10.0.30.11       -</pre>

            <h3>show ports [of] &lt;device&gt;</h3>
            <p>Tabella delle sole porte fisiche: stato, modalità, VLAN, security zone.</p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">show ports of FW-1</span>
<span class="hd">PORT   STATE      MODE     VLAN       ZONE</span>
1      up         wan      -          untrust
2      up         lan      -          trust
3      up         dmz      -          dmz
<span class="mu">4      down       -        -          -</span></pre>

            <h3>show vlans</h3>
            <p>Appartenenza VLAN attraverso tutta la topologia.</p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">show vlans</span>
<span class="hd">VLAN   MEMBERS</span>
10     PC-Sales-1, PC-Sales-2, Core-Switch-HQ
20     PC-Eng-1, Core-Switch-HQ
30     Core-Switch-HQ, FW-1</pre>

            <h3>show connections [of &lt;device&gt;]</h3>
            <p>
                I link della topologia — tutti, o solo quelli di un dispositivo. Quando il
                link è agganciato a porte fisiche, il binding è mostrato.
            </p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">show connections of Core Switch HQ</span>
<span class="hd">CONNECTIONS of Core-Switch-HQ (3)</span>
  Core-Switch-HQ ↔ Router-Core  (uplink, 10G)  [port 24 ↔ port 1]
  Core-Switch-HQ ↔ SW-Access-2  (trunk, 1G)  [port 1 ↔ port 8]
  Core-Switch-HQ ↔ FW-1  (backbone, 10G)</pre>

            <h3>show config [of] &lt;device&gt;</h3>
            <p>La scheda completa del dispositivo: indirizzamento, VLAN, STP, porte, NIC.</p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">show config of Core Switch HQ</span>
<span class="hd">Core-Switch-HQ — switch (Generic)</span>
  ip:       192.168.1.2
  subnet:   255.255.255.0
  gateway:  192.168.1.1
  location: HQ - Floor 1
  vlans:    10, 20, 30
  stp:      rapid-pvst priority 4096
  ports:    22/24 enabled — "show ports Core-Switch-HQ" for detail</pre>

            <h3>show neighbors [of] &lt;device&gt;</h3>
            <p>I dispositivi direttamente collegati (l'equivalente neutro di CDP/LLDP).</p>
            <pre class="console">
<span class="p">PC-Sales-1&gt;</span> <span class="c">show neighbors</span>
<span class="hd">NEIGHBORS of PC-Sales-1 (1)</span>
  SW-Access-2              switch         192.168.10.2</pre>

            <h3>show ip [of] &lt;device&gt; <span class="badge alias">ipconfig · ifconfig</span></h3>
            <p>
                Il riepilogo compatto dell'indirizzamento: IP primario, maschera e gateway
                del dispositivo, più una riga per ogni NIC. È il comando che gli alias
                OS-style <code>ipconfig</code> / <code>ifconfig</code> richiamano
                d'istinto.
            </p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">show ip of Web-01</span>
<span class="hd">Web-01 — server</span>
  ip:       10.0.20.11
  subnet:   255.255.255.0
  gateway:  10.0.20.1
  nic eth0: 10.0.20.11 / 255.255.255.0  gw 10.0.20.1
  nic eth1: 10.0.30.11 / 255.255.255.0  gw 10.0.30.1</pre>
        </section>

        <!-- ═══════════════════════ 5. CONFIGURAZIONE ═══════════════════════ -->
        <section class="card" id="configurazione">
            <h2>5. Configurazione</h2>
            <p>
                I comandi di scrittura modificano il canvas passando dalle <em>stesse
                azioni</em> degli edit grafici: ogni modifica è quindi
                <strong>autosalvata</strong> come qualunque altro edit del canvas
                (debounce di 2 secondi verso il backend) e coerente con l'Inspector.
            </p>

            <h3>set — proprietà del dispositivo</h3>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">set ip of PC-1 to 192.168.1.99</span>
<span class="ok">PC-1: ip set to 192.168.1.99</span>

<span class="p">pixelcake&gt;</span> <span class="c">set gateway PC-1 192.168.1.1</span>
<span class="ok">PC-1: gateway set to 192.168.1.1</span>

<span class="p">pixelcake&gt;</span> <span class="c">set name of PC-1 to Reception Desk</span>
<span class="ok">PC-1 renamed to "Reception Desk"</span></pre>
            <p>Il valore è validato prima della scrittura:</p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">set ip of PC-1 to 999.1.2.3</span>
<span class="er">"999.1.2.3" is not a valid IPv4 address</span>

<span class="p">pixelcake&gt;</span> <span class="c">set ip of Web-01 to 10.0.20.99</span>
<span class="er">Web-01 uses NICs — the device-level IP is read-only</span>
<span class="mu">  edit the NIC in the Inspector instead (per-NIC terminal config coming later)</span></pre>

            <h3>add / remove vlan</h3>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">add vlan 20 to SW Floor 1</span>
<span class="ok">SW-Floor-1: added to VLAN 20 (now [10, 20])</span>

<span class="p">pixelcake&gt;</span> <span class="c">remove vlan 20 from SW Floor 1</span>
<span class="ok">SW-Floor-1: removed from VLAN 20 (now [10])</span></pre>

            <h3>connect / disconnect</h3>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">connect Web-01 to Core Switch HQ</span>
<span class="ok">connected Web-01 ↔ Core-Switch-HQ</span>

<span class="p">pixelcake&gt;</span> <span class="c">disconnect Web-01 from Core Switch HQ</span>
<span class="ok">disconnected Web-01 ↔ Core-Switch-HQ</span></pre>

            <h3>interface &lt;n&gt; up|down <span class="badge canon">forma canonica</span></h3>
            <p>
                Lo stato amministrativo di un'interfaccia si cambia con la forma canonica
                <code>interface &lt;n&gt; up|down [on] &lt;device&gt;</code>. La variante
                storica <code>enable|disable port &lt;n&gt; on &lt;device&gt;</code> resta
                accettata come sinonimo.
            </p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">interface 3 down on Core Switch HQ</span>
<span class="ok">port 3 on Core-Switch-HQ is now down</span>

<span class="p">pixelcake&gt;</span> <span class="c">interface 3 up on Core Switch HQ</span>
<span class="ok">port 3 on Core-Switch-HQ is now up</span>

<span class="p">pixelcake&gt;</span> <span class="c">disable port 5 on FW-1</span>  <span class="mu">(variant)</span>
<span class="ok">port 5 on FW-1 is now down</span></pre>
            <div class="note">
                Un'interfaccia <code>down</code> ha effetto immediato sulla diagnostica: i
                <code>ping</code>/<code>trace</code> che attraversano un link agganciato a
                quella porta vengono bloccati con
                <code>port &lt;n&gt; on &lt;device&gt; is disabled</code>.
            </div>
        </section>

        <!-- ═══════════════════════ 6. SESSIONE ═══════════════════════ -->
        <section class="card" id="sessione">
            <h2>6. Sessione e contesto</h2>
            <p>
                <code>use &lt;device&gt;</code> apre un contesto dispositivo: il prompt
                passa da <code>pixelcake&gt;</code> a <code>&lt;device&gt;&gt;</code> e da
                quel momento <code>from</code> è implicito nei comandi diagnostici, così
                come il dispositivo nei comandi <code>show</code> e di configurazione che
                lo omettono. <code>exit</code> (alias <code>quit</code>) torna allo scope
                globale; <code>clear</code> (alias <code>cls</code>) pulisce lo schermo;
                <code>help [topic]</code> stampa la reference, filtrabile per argomento.
            </p>
            <pre class="console">
<span class="p">pixelcake&gt;</span> <span class="c">use PC Sales 1</span>
<span class="ok">context: PC-Sales-1 — "from" is now implied, "exit" to leave</span>
<span class="p">PC-Sales-1&gt;</span> <span class="c">ping Web-01</span>
<span class="mu">Pinging Web-01 (10.0.20.11) from PC-Sales-1...</span>
<span class="ok">Reply from 10.0.20.11: hops=4 time=5ms</span>
<span class="p">PC-Sales-1&gt;</span> <span class="c">show neighbors</span>
<span class="hd">NEIGHBORS of PC-Sales-1 (1)</span>
  SW-Access-2              switch         192.168.10.2
<span class="p">PC-Sales-1&gt;</span> <span class="c">exit</span>
<span class="mu">left PC-Sales-1</span>
<span class="p">pixelcake&gt;</span></pre>
        </section>

        <!-- ═══════════════════════ 7. EMAIL E FLUSSI ═══════════════════════ -->
        <section class="card" id="flussi">
            <h2>7. Email e flussi</h2>
            <p>
                Lo stesso motore che giudica <code>ping</code> e <code>trace</code> valuta
                i <strong>modelli di flusso</strong> della simulazione sul canvas:
                <code>ping</code>, <code>web</code>, <code>download</code> ed
                <code>email</code>. Ogni modello è un piano di una o più <em>tratte</em>
                (legs), ciascuna valutata hop per hop con le stesse regole della
                diagnostica; il verdetto complessivo è <code>success</code> solo se tutte
                le tratte passano, e la valutazione si ferma alla prima tratta che
                fallisce.
            </p>
            <div class="tbl"><table>
                <tr><th>Modello</th><th>Tratte</th></tr>
                <tr><td><code>ping</code></td><td>request src→dst, poi reply dst→src (le asimmetrie emergono)</td></tr>
                <tr><td><code>web</code></td>
                    <td>HTTP request src→dst, HTTP response dst→src (nota se il target non è server-like)</td></tr>
                <tr><td><code>download</code></td><td>download request src→dst, download data dst→src</td></tr>
                <tr><td><code>email</code></td>
                    <td>src→relay (submit), relay→dst (delivery) — il relay dipende dalla modalità</td></tr>
            </table></div>

            <h3>Le tre modalità email</h3>
            <ul>
                <li><strong><code>internal</code></strong> — il relay è il <em>mail server
                    interno</em> più vicino alla sorgente (distanza in hop BFS). Tratte:
                    <code>SMTP submit</code> + <code>delivery</code>. Se in rete non c'è
                    alcun mail server:
                    <code>no mail server in the network — add a Mail Server device to deliver email</code>.</li>
                <li><strong><code>cloud</code></strong> — il relay è l'<em>uscita
                    internet</em> più vicina (dispositivi Internet/Cloud/WAN/ISP). Tratte:
                    <code>SMTP to cloud provider</code> + <code>cloud delivery</code>.
                    Senza uscita internet:
                    <code>no internet exit in the network — cloud email needs an
                    Internet gateway or Cloud device</code>.</li>
                <li><strong><code>auto</code></strong> (default) — preferisce il mail server
                    interno; se non esiste ripiega sul cloud annotandolo
                    (<code>no internal mail server: using cloud email via &lt;relay&gt;</code>);
                    se non esiste nemmeno l'uscita internet, l'errore lo dice ed elenca i
                    rimedi.</li>
            </ul>
            <div class="note">
                Cosa significa per la simulazione: la modalità email cambia la
                <em>forma del percorso animato</em> e i punti in cui il flusso può
                fallire. Con <code>internal</code> un firewall fra client e mail server
                può bloccare il submit; con <code>cloud</code> è il tratto verso
                l'uscita internet a essere giudicato. Se un endpoint è già esso stesso il
                relay (es. si invia <em>al</em> mail server), il piano si riduce a una
                tratta sola.
            </div>
        </section>

        <!-- ═══════════════════════ 8. CONVENZIONI ═══════════════════════ -->
        <section class="card" id="convenzioni">
            <h2>8. Convenzioni e tolleranze</h2>
            <p>
                Le tolleranze sono <strong>parte della specifica</strong>: un terminale
                NCL conforme le implementa tutte.
            </p>
            <ul>
                <li><strong>Nomi multi-parola</strong> — i nomi dei dispositivi possono
                    contenere spazi; le keyword di ruolo
                    (<code>from</code>/<code>to</code>/<code>of</code>/<code>on</code>) li
                    delimitano: <code>ping PC Sales 1 from Core Switch HQ</code>.</li>
                <li><strong>Virgolette doppie</strong> — un nome quotato è sempre letterale,
                    anche se contiene keyword: <code>use "Meeting Room Host"</code>.</li>
                <li><strong>Case-insensitive</strong> — comandi, keyword e nomi:
                    <code>PING WEB-01</code> ≡ <code>ping web-01</code>.</li>
                <li><strong>IP ovunque</strong> — un indirizzo IP è accettato ovunque sia
                    atteso un dispositivo: <code>ping 10.0.20.11 from 192.168.10.11</code>.</li>
                <li><strong>Rumore ammesso</strong> — articoli (<code>the</code>,
                    <code>a</code>) e sostantivi (<code>device</code>, <code>host</code>)
                    in testa ai segmenti-nome vengono scartati:
                    <code>ping the Web-01 from host PC-1</code>.</li>
                <li><strong>Did-you-mean</strong> — verbi e dispositivi sconosciuti
                    producono un suggerimento per distanza di edit:
                    <code>pnig Web-01</code> → <code>did you mean "ping"?</code>;
                    <code>ping Wev-01</code> → <code>did you mean "Web-01"?</code>.</li>
                <li><strong>Risoluzione fuzzy</strong> — i nomi sono confrontati in modo
                    tollerante (maiuscole, trattini/spazi); il match esatto vince sempre
                    su quello fuzzy.</li>
            </ul>

            <h3>Alias completi</h3>
            <div class="tbl"><table>
                <tr><th>Alias</th><th>Forma canonica</th></tr>
                <tr><td><code>sh</code></td><td><code>show</code></td></tr>
                <tr><td><code>ls</code>, <code>list</code></td><td><code>show devices</code></td></tr>
                <tr><td><code>ipconfig</code>, <code>ifconfig</code></td><td><code>show ip</code></td></tr>
                <tr><td><code>traceroute</code>, <code>tracert</code></td><td><code>trace</code></td></tr>
                <tr><td><code>delete vlan …</code></td><td><code>remove vlan …</code></td></tr>
                <tr><td><code>enable|disable port &lt;n&gt; on &lt;device&gt;</code></td>
                    <td><code>interface &lt;n&gt; up|down [on] &lt;device&gt;</code>
                        <span class="badge alias">variante accettata</span></td></tr>
                <tr><td><code>quit</code></td><td><code>exit</code></td></tr>
                <tr><td><code>cls</code></td><td><code>clear</code></td></tr>
                <tr><td><code>?</code></td><td><code>help</code></td></tr>
            </table></div>
        </section>

        <!-- ═══════════════════════ 9. ROADMAP ═══════════════════════ -->
        <section class="card" id="roadmap">
            <h2>9. Roadmap del linguaggio</h2>
            <p>
                NCL è versionato indipendentemente dall'applicazione: la v0.1 copre
                diagnostica, ispezione e la configurazione di base. <strong>La spec
                crescerà con le capacità del motore</strong> — ogni estensione manterrà i
                principi di §1 (verb-first, preposizioni opzionali, vocabolario neutro).
            </p>
            <ul>
                <li><strong>Configurazione per-NIC</strong> — indirizzare le singole
                    interfacce degli end device:
                    <code>set ip of eth1 on Web-01 to 10.0.30.99</code>. Oggi l'IP di un
                    dispositivo con NIC è read-only da terminale.</li>
                <li><strong>ACL e policy</strong> — regole firewall espresse nel linguaggio:
                    <code>allow dmz to trust port 443 on FW-1</code>, con la diagnostica
                    che le valuta al posto delle sole transizioni di zona predefinite.</li>
                <li><strong>Route statiche</strong> — instradamento esplicito:
                    <code>route add 10.0.30.0/24 via 10.0.0.1 on Router-Core</code>, per
                    superare l'attuale modello "almeno un router sul percorso".</li>
            </ul>
            <div class="warn">
                Fino alla v1.0 la spec è in bozza: le forme canoniche sono stabili, ma
                alias e formati di output possono ancora essere raffinati tra le minor
                version.
            </div>
        </section>

        <footer>
            NCL v0.1 — sorgente della spec: <code>docs/terminal-commands.md</code> ·
            <a href="/">Pixelcake API</a> · <a href="/docs">Swagger UI</a>
        </footer>
    </div>
</body>
</html>
"""


@app.get("/docs/terminal", response_class=HTMLResponse, include_in_schema=False)
async def ncl_reference():
    """
    NCL — Network Command Language v0.1
    Complete reference for the vendor-neutral terminal language
    """
    return NCL_REFERENCE_HTML


@app.get("/api/health")
async def health_check():
    """API health check"""
    return {"status": "healthy"}


@app.get("/api/admin/health")
async def admin_health_dashboard():
    """
    Admin dashboard health check endpoint
    Returns comprehensive system health data
    """
    return await get_all_health()


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    """
    System health dashboard
    Displays real-time monitoring of API and Database status
    """
    # Read the dashboard template
    template_path = os.path.join(
        os.path.dirname(__file__),
        "app", "admin", "templates", "dashboard.html"
    )

    with open(template_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    return html_content


# TODO: Import routers when implemented
# from routers import simulate, export, import_tf
# app.include_router(simulate.router, prefix="/api/simulate", tags=["simulation"])
# app.include_router(export.router, prefix="/api/export", tags=["export"])
# app.include_router(import_tf.router, prefix="/api/import", tags=["import"])


if __name__ == "__main__":
    import uvicorn
    # Loopback only: the API has no authentication, so it must not be
    # reachable from other machines on the network.
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
