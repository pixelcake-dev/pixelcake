/**
 * The guide. Every sentence states something the app really does: whoever
 * changes a behaviour described here changes the text too, in both languages.
 * Words between backticks are shown as code; a name between «» is the name
 * of a control, written as that control shows it.
 */
export const help = {
  title: 'Guida',
  close: 'Chiudi la guida',
  sections: 'Sezioni della guida',

  tabs: {
    guide: 'Come si usa',
    commands: 'Comandi del terminale',
    about: 'Informazioni',
  },

  intro:
    'PixelCake serve a disegnare una piccola rete, configurarla e verificare se un dispositivo ne ' +
    'raggiunge un altro.',

  steps: {
    addDevices: {
      title: 'Aggiungi i dispositivi',
      text:
        'Nella barra a sinistra apri «Aggiungi dispositivo» (il pulsante +) e scegli un tipo ' +
        "dall'elenco: controlla il nome e conferma, l'indirizzo IP viene proposto in automatico " +
        'e si può cambiare, o lasciare al DHCP; un nome che ha già un altro dispositivo non viene ' +
        'accettato. Il dispositivo compare nel primo posto libero della parte di canvas che stai ' +
        'guardando, riga per riga da in alto a sinistra, ed è già selezionato. ' +
        '«Aggiungi in blocco» ne crea molti in una volta. Nella scheda «Esempi» dello stesso ' +
        'pannello ci sono cinque reti di esempio già pronte: quella di una piccola azienda (la ' +
        'stessa della schermata di benvenuto), una semplice, una con VLAN, DMZ e firewall, una ' +
        'con due sedi e una linea di riserva, e la rete grande di una multinazionale, con dieci ' +
        'sedi in Italia. Caricarne una prende il posto di quanto è sul ' +
        'canvas. Ogni rete di esempio arriva con le sue impostazioni di rete (Impostazioni → ' +
        'Rete): la rete da cui partono i nuovi dispositivi, il server DNS, i nomi delle VLAN.',
    },
    moveAndSelect: {
      title: 'Spostali e selezionali',
      text:
        'Trascina un dispositivo per spostarlo. Con Ctrl + clic ne selezioni più di uno, trascinando ' +
        "su un'area vuota disegni un riquadro di selezione, che prende anche i riquadri che contiene " +
        'per intero. Con due o più dispositivi selezionati, sopra di loro compare «Racchiudi in un ' +
        'riquadro». Ctrl + C e Ctrl + V copiano e incollano la selezione: la copia prende il primo ' +
        'nome libero (da PC-1 il primo PC-n libero), ogni scheda di rete un MAC nuovo, e i PC e gli ' +
        "altri dispositivi finali che non sono server chiedono l'indirizzo al DHCP. Il tasto Canc " +
        'elimina la selezione, dopo averlo chiesto. Trascinando con il tasto destro su ' +
        "un'area vuota sposti la vista, con la rotellina fai lo zoom. Tutte le scorciatoie sono in " +
        'Impostazioni → Avanzate. Vista → «Disposizione automatica» → «Verticale» o «Orizzontale» ' +
        'li dispone di nuovo: in cima ciò da cui il traffico esce dalla rete (Internet, se no il ' +
        'firewall, se no il router), sotto un livello per ogni cavo; i riquadri vanno con i loro ' +
        'dispositivi. Prima chiede conferma: sposta ogni dispositivo e non si può annullare.',
    },
    connect: {
      title: 'Collegali',
      text:
        'Passa con il mouse sul bordo di un dispositivo: il lato sotto il puntatore diventa ' +
        'arancione. Trascina da lì fino a un altro dispositivo e lascialo andare sopra: il cavo ' +
        'arriva sul lato dove lo lasci. A ciascun capo la connessione viene assegnata a una ' +
        'porta o a una scheda di rete libera. Su un firewall con zone di sicurezza la porta va scelta a mano. ' +
        'Con un clic destro sulla connessione, «Modifica connessione» permette di cambiare le ' +
        "interfacce, il tipo, la banda, l'etichetta e il colore. Vista → «Collega i dispositivi " +
        'senza cavo» dà un cavo a ogni dispositivo che non ne ha: allo switch più vicino della sua ' +
        'rete, su una porta libera adatta (portatili, smartphone e tablet prima a un access point); ' +
        'un gruppo di dispositivi senza router né firewall va al router, al firewall o al core ' +
        'switch più vicino della sua rete. Router, firewall e Internet si collegano a mano. Alla ' +
        'fine un avviso dice quanti cavi ha aggiunto e chi è rimasto senza, e perché.',
    },
    areas: {
      title: 'Raggruppa con i riquadri',
      text:
        'Un riquadro è un rettangolo colorato con un nome, disegnato dietro a un gruppo di ' +
        'dispositivi per dire cosa sono: Core, Edge, Uffici, Internet. Le reti di esempio, ' +
        "tranne la più semplice, ne hanno già. Nel pannello «Aggiungi dispositivo» c'è " +
        '«Riquadro», che ne aggiunge uno al centro della vista; oppure seleziona i dispositivi e ' +
        "scegli Modifica → «Racchiudi in un riquadro» (c'è anche nel clic destro su un " +
        'dispositivo): il riquadro nasce intorno a loro. Scrivi il nome e premi Invio. Un ' +
        'riquadro si prende dal nome o dal bordo: trascinandolo si sposta, e i dispositivi ' +
        'restano dove sono; quando è selezionato da solo mostra otto maniglie per ridimensionarlo. ' +
        'Con Ctrl + clic sul nome entra nella selezione insieme ai dispositivi, e si sposta, si ' +
        'copia e si elimina con loro. Un ' +
        'doppio clic sul nome lo rinomina, il clic destro apre un menu con «Rinomina», i colori ' +
        "ed «Elimina», e il tasto Canc, dopo averlo chiesto, elimina il riquadro selezionato. L'interno di un riquadro " +
        'non intralcia: lì dentro i dispositivi si selezionano, si collegano e si spostano come ' +
        "sempre. I riquadri si vedono anche in presentazione e nell'immagine esportata, e " +
        'vengono salvati con il progetto. Vista → «Mostra i riquadri» li nasconde e li mostra ' +
        'di nuovo: è una scelta di questo browser, che non cambia il disegno. Nascosti, non si ' +
        "vedono né in presentazione né nell'immagine, e non si possono prendere; un riquadro " +
        'nuovo li fa vedere di nuovo.',
    },
    configure: {
      title: 'Configurali',
      text:
        'Un doppio clic su un dispositivo ne apre la scheda (la stessa di clic destro → ' +
        '«Dettagli (modifica)»). La prima schermata, «Generale», è fatta per il dispositivo: di ' +
        'un PC o di un server mostra nome e indirizzo, che si scrive lì; di uno switch le VLAN e ' +
        'come sono divise le porte; di un router o di un firewall le porte in uso, ciascuna con ' +
        'indirizzo, a cosa è collegata e ruolo. Switch, router e firewall hanno anche la scheda ' +
        '«Porte»: scegli una porta e sotto compaiono le sue impostazioni; lì si cambia anche il ' +
        '«Numero di porte». Gli altri dispositivi hanno «Schede di rete», con nome, velocità e ' +
        'MAC di ogni scheda. Su «Generale» ogni dispositivo ha anche le «Note»: un testo libero, ' +
        'di più righe, per ciò che non sta in un campo. Sul disegno un piccolo quadrato dopo il ' +
        'nome dice che il dispositivo ha una nota, e la leggi fermando il puntatore sul ' +
        'dispositivo. Quello che non va viene detto sotto il campo mentre scrivi; ' +
        'le modifiche valgono solo dopo aver premuto «Salva».',
    },
    route: {
      title: 'Instrada tra le reti',
      text:
        'Ogni porta di un router o di un firewall può avere un indirizzo (scheda «Porte»): è il ' +
        'gateway dei dispositivi collegati lì, e la rete di quella porta è raggiunta senza altro. Le ' +
        "reti che stanno dietro un altro router si scrivono nella scheda «Rotte», con l'indirizzo del " +
        'prossimo salto; il gateway del router è la sua rotta predefinita. La stessa scheda mostra la ' +
        'tabella di instradamento che ne risulta. Serve una rotta anche per il ritorno. Una seconda ' +
        'rotta per la stessa rete è di riserva: subentra quando la linea della prima è giù.',
    },
    vlans: {
      title: 'Separa con le VLAN',
      text:
        'Nella scheda «Porte» di uno switch ogni porta è di accesso, in una VLAN, oppure trunk, e ' +
        "trasporta più VLAN con l'etichetta. Due porte in VLAN diverse non si parlano: per farle " +
        'comunicare serve un router con una porta in ciascuna. Appena una porta ha una VLAN, quelle ' +
        'che non hai toccato sono nella VLAN 1. Le VLAN si possono chiamare per nome: in Impostazioni ' +
        '→ Rete, sotto «VLAN del progetto», trovi quelle usate sul canvas e scrivi il nome di ' +
        "ciascuna; «Aggiungi VLAN» ne aggiunge un'altra. Dopo aver salvato, il nome compare accanto " +
        'al numero, per esempio VLAN 10 «Uffici», nella scheda dello switch e nelle impostazioni ' +
        'delle sue porte. Nel terminale le VLAN restano numeri.',
    },
    firewall: {
      title: 'Filtra con il firewall',
      text:
        'Le porte di un firewall si mettono in una zona: trust, untrust o dmz. Senza regole ' +
        'decide la politica delle zone: verso una zona più fidata il traffico è negato, il resto ' +
        "passa. Nella scheda «Regole» si scrivono le eccezioni, lette dall'alto in basso: decide " +
        'la prima che corrisponde, per servizio (ping, web, email, DNS), partenza e ' +
        'destinazione. Un firewall lascia passare la risposta a un flusso che ha permesso lui ' +
        'stesso. Anche un router ha la scheda «Regole»: le sue regole filtrano ciò che instrada. ' +
        'Un router senza regole lascia passare tutto; appena ne ha una attiva, blocca ciò che ' +
        'nessuna regola permette, come un router vero.',
    },
    nat: {
      title: 'Esci su Internet con il NAT',
      text:
        'Un simbolo Cloud chiamato «Internet» non trasporta gli indirizzi privati (10.x, ' +
        '172.16–31.x, 192.168.x): chi sta dentro non esce e chi sta fuori non entra, finché un ' +
        'router o un firewall non traduce gli indirizzi. Nella scheda «NAT» del router o del ' +
        'firewall spunta la porta rivolta a Internet (è la stessa scelta di «NAT attivo» sulla ' +
        "porta, nella scheda «Porte»): ciò che esce prende l'indirizzo di quella porta, e la " +
        'risposta torna a chi aveva chiesto. Per raggiungere da fuori un server che sta dentro, ' +
        'lì sotto premi «Aggiungi inoltro»: servizio, porta su cui arriva, indirizzo interno. ' +
        "Chi è fuori chiede all'indirizzo della porta e la risposta gli torna da lì. Su un " +
        'firewall serve anche la regola che lo permette, nella scheda «Regole». La rete di ' +
        'esempio della schermata di benvenuto è fatta così.',
    },
    dhcp: {
      title: 'Dai gli indirizzi con il DHCP',
      text:
        "Un dispositivo può prendere l'indirizzo da solo: nella scheda «Schede di rete», alla " +
        'voce «Indirizzo», scegli «Automatico (DHCP)» al posto di «Manuale». Glielo dà un server ' +
        'DHCP della stessa rete: una porta di router o di firewall, oppure la scheda di un ' +
        'server. Si attiva nella scheda «DHCP» di quel dispositivo, con la spunta accanto alla ' +
        "porta o alla scheda: l'intervallo da «Primo indirizzo» a «Ultimo indirizzo» viene " +
        'proposto, e si può cambiare (è la stessa scelta di «Server DHCP attivo» sulla porta o ' +
        "sulla scheda). Con l'indirizzo arrivano la subnet mask e il gateway. Gli indirizzi si " +
        'calcolano dal disegno, sempre allo stesso modo: i dispositivi vengono serviti ' +
        "nell'ordine in cui compaiono e ciascuno prende il primo indirizzo libero, saltando " +
        'quelli scritti a mano. La scheda «DHCP» elenca anche chi ha preso quale indirizzo, e ' +
        'sul disegno un indirizzo assegnato è seguito da «DHCP». Una scheda che non trova un ' +
        'server resta senza indirizzo, e la sua finestra dice perché; quando è la prima scheda ' +
        'del dispositivo, sul canvas la parte alta del suo disegno diventa gialla. Un router non passa la ' +
        "richiesta a un'altra rete: il relay non è simulato, e nemmeno le prenotazioni e le " +
        'scadenze. Nella rete di esempio della schermata di benvenuto i due portatili prendono ' +
        "l'indirizzo così, da Router-Core.",
    },
    dns: {
      title: 'Chiama i dispositivi per nome con il DNS',
      text:
        'Un server può fare da server DNS: nella sua scheda «DNS» premi «Aggiungi record» e ' +
        "scrivi un nome, per esempio `gestionale.azienda.example`, e l'indirizzo a cui " +
        'corrisponde. A chi chiedere lo decide ogni dispositivo: nella scheda «Schede di rete» ' +
        "il campo «Server DNS» contiene l'indirizzo del server. Per non scriverlo ogni volta, in " +
        "Impostazioni → Rete c'è «Server DNS predefinito»: i nuovi dispositivi nascono con " +
        'quello sulla scheda e, una volta salvato, lì sotto si può assegnarlo anche ai ' +
        "dispositivi del canvas che non ne hanno uno. Chi prende l'indirizzo dal DHCP riceve " +
        'anche quello, se nel server DHCP è compilato «Server DNS consegnato (facoltativo)». Un ' +
        'nome si usa nel terminale al posto di un indirizzo: `ping gestionale.azienda.example ' +
        "from PC-Vendite` chiede prima l'indirizzo al server DNS, con una domanda che attraversa " +
        'la rete come ogni altro scambio e può fermarsi allo stesso modo, e poi fa il ping; ' +
        '`resolve gestionale.azienda.example from PC-Vendite` fa soltanto la domanda. Per un ' +
        'firewall la domanda è il servizio «DNS», che si sceglie nelle regole e negli inoltri. ' +
        'Nulla viene ricordato: il nome viene chiesto di nuovo ogni volta. Non sono simulati un ' +
        "secondo server DNS di riserva, l'inoltro ad altri server e la ricerca inversa; la " +
        'simulazione e la presentazione scelgono i dispositivi dai menu e non usano i nomi. ' +
        'Nella rete di esempio della schermata di benvenuto Srv-Auth conosce tre nomi, gli ' +
        'uffici e i portatili chiedono a lui, e Cliente-Remoto non ha nessuno a cui chiedere.',
    },
    ask: {
      title: 'Chiedi se un dispositivo ne raggiunge un altro',
      text:
        'Apri «Simulazione» (il pulsante con il fulmine), scegli «Partenza», «Destinazione» e il ' +
        '«Tipo di traffico» (ping, email, pagina web o download), poi premi «Avvia simulazione». ' +
        "Il pacchetto percorre la rete sul disegno. Se non arriva, l'animazione si ferma dove il " +
        'traffico viene bloccato e un messaggio ne spiega il motivo: quale dispositivo, quale ' +
        'porta, quale rotta o quale regola. Quando il pacchetto è arrivato in fondo, la parte ' +
        'alta del disegno del dispositivo che risponde diventa verde, o quella del dispositivo ' +
        'dove la domanda si ferma diventa rossa, con il bordo dello stesso colore; restano così ' +
        'fino alla domanda successiva, a una modifica del disegno o a un clic su un punto vuoto ' +
        'del canvas. Vale anche per le domande fatte dal terminale.',
    },
    terminal: {
      title: 'Usa il terminale',
      text:
        '«Console», nella barra a sinistra, apre il terminale. Con un clic destro su un ' +
        'dispositivo → «Console» si apre già posizionato su quel dispositivo. I comandi sono in ' +
        'inglese, per esempio, sulla rete di esempio della schermata di benvenuto, `ping ' +
        'Web-Gestionale from PC-Vendite`, `trace Web-Gestionale from Portatile-1 as web` oppure ' +
        '`show routes Router-Core`. Quelli che cambiano la rete, come `add route 192.168.40.0/24 ' +
        "via 10.0.0.2 on Router-Core`, modificano lo stesso disegno che vedi. L'elenco è nella " +
        'scheda «Comandi del terminale».',
    },
    present: {
      title: 'Presenta la rete',
      text:
        '«Presenta», in alto a destra, mette via gli strumenti per disegnare: resta il disegno, ' +
        'adattato alla finestra e non più modificabile con il mouse, con un pannello accanto. Un ' +
        'clic su un dispositivo apre un piccolo menu: «Parti da qui» e «Arriva qui» scelgono i ' +
        'due capi della domanda, che si possono scegliere anche dai menu «Da» e «A» del ' +
        'pannello. Scelto il tipo di traffico (Ping, Web o Email) il pacchetto parte da solo e ' +
        'il pannello dice se arriva, per quali dispositivi passa e, se si ferma, dove e perché. ' +
        'Nella barra in alto si regola la velocità del pacchetto, si apre il terminale e si ' +
        'passa a schermo intero. Si esce con «Esci» o con il tasto Esc.',
    },
    failures: {
      title: 'Chiedi cosa succede se qualcosa si rompe',
      text:
        'In presentazione, un clic su un dispositivo o su un cavo e poi «Simula un guasto» lo ' +
        "considera rotto. Il disegno non cambia, e all'uscita il guasto sparisce. La domanda sullo " +
        "schermo viene rifatta subito: se c'è un'altra strada il pacchetto la prende, altrimenti si " +
        'ferma e il pannello dice dove. Tra switch la strada è la più corta che funziona; un router ' +
        'passa alla rotta di riserva quando la linea della rotta principale è guasta. Sotto «Guasti ' +
        "simulati» c'è l'effetto sul resto della rete: quante comunicazioni tra i dispositivi finali " +
        "si interrompono, quante passano da un'altra strada, quante non cambiano. Un clic su una di " +
        'esse la mostra. La rete di esempio «Due sedi: linea principale e di riserva» è fatta per ' +
        'provarlo. Lo spanning tree non è simulato.',
    },
    picture: {
      title: 'Esporta il disegno come immagine',
      text:
        "File → Esporta immagine… mostra l'anteprima del disegno intero, senza selezioni. " +
        'Scegli il formato: PNG, per documenti, presentazioni e messaggi, ' +
        'in tre grandezze, oppure SVG, vettoriale. Scegli il tema, chiaro o scuro qualunque sia ' +
        "quello dello schermo, e con «Nome del progetto in alto» e «Sfondo trasparente» cosa c'è " +
        'intorno al disegno. «Salva PNG…» chiede dove salvare il file; nei browser che non ' +
        'possono chiederlo il pulsante è «Scarica PNG». Dove il browser lo permette, «Copia ' +
        "negli appunti» lascia l'immagine pronta da incollare. In presentazione la stessa " +
        "finestra si apre dal pulsante «Esporta immagine» della barra in alto: l'immagine mostra " +
        'i guasti simulati e il percorso della risposta e, con «Domanda e risposta sotto il ' +
        'disegno», riporta la domanda e la sua risposta.',
    },
    canvases: {
      title: 'Dividi il progetto in canvas',
      text:
        'Un progetto può avere più canvas. In «Explorer», il primo pulsante della barra a ' +
        'sinistra, ne aggiungi con «Nuovo canvas», li rinomini, li duplichi con «Duplica il ' +
        "canvas» (la copia, con tutto quello che c'è sopra, compare subito dopo), li elimini (ne " +
        "resta sempre almeno uno) e passi dall'uno all'altro con un clic. Lì si cambiano anche il nome e la " +
        'descrizione del progetto.',
    },
    save: {
      title: 'Salva su file',
      text:
        'Il lavoro resta nel browser anche dopo aver ricaricato la pagina. Per conservarlo, o ' +
        'per portarlo su un altro computer, usa File → Salva (Ctrl + S): il progetto, con tutti ' +
        'i suoi canvas, viene scritto in un file `.pixelcake.json`, che si riapre con la voce ' +
        'File → Apri… In Chrome e in Edge il file scelto viene aggiornato a ogni salvataggio, ' +
        'negli altri browser viene scaricato.',
    },
    yaml: {
      title: 'Importa ed esporta in YAML',
      text:
        '«Import/Export», nella barra a sinistra, esporta in YAML la rete del canvas aperto, da ' +
        'copiare o da scaricare, e la ricarica da un file `.yaml` o `.yml`, al posto di quella ' +
        "presente oppure in aggiunta. L'esportazione Terraform è soltanto una bozza e non si può " +
        'applicare.',
    },
    language: {
      title: 'Scegli la lingua',
      text:
        "L'interfaccia è in italiano e in inglese: si sceglie con IT ed EN in alto a destra, " +
        'accanto al tema, oppure in Impostazioni → Aspetto. Cambia subito, senza ricaricare la ' +
        'pagina, e la scelta resta salvata in questo browser. Quello che hai scritto tu non ' +
        "cambia, e nemmeno i nomi che l'applicazione ha già dato: un progetto, un canvas, i " +
        'dispositivi di una rete di esempio restano nella lingua in cui sono nati. Il terminale ' +
        'parla inglese in entrambe le lingue.',
    },
  },

  prototype:'PixelCake è un prototipo: serve a ragionare su una piccola rete, non a validarne una reale.',

  commands: {
    intro:
      'Lo stesso elenco compare scrivendo `help` nel terminale. I nomi dei dispositivi non ' +
      'distinguono maiuscole e minuscole e possono essere di più parole. Dove un comando chiede una ' +
      'destinazione si può scrivere anche un nome come `www.azienda.example`: il dispositivo di ' +
      "partenza ne chiede prima l'indirizzo al proprio server DNS.",
    /** `<docs>` is the link to the terminal reference of the documentation, in a new tab of the browser */
    reference:
      'Ogni comando, con la sintassi completa ed esempi veri, è spiegato nel <docs>riferimento del ' +
      'terminale</docs> della documentazione, che si apre in una nuova scheda del browser.',
    command: 'Comando',
    does: 'Cosa fa',
  },

  about: {
    description: 'Ambiente visuale per disegnare una piccola rete e verificarla',
    version: 'Versione',
    licence: 'Licenza',
    licenceText: 'AGPL-3.0, open source',
    site: 'Sito',
    repository: 'Repository',
    technologies: 'Tecnologie',
    /** What the app bundles from others, each name a link to the text of its licence */
    thirdParty: {
      title: 'Licenze di terzi',
      fonts: 'Caratteri',
      icons: 'icone',
      /** Between the last two names of a list */
      and: ' e ',
    },
  },
};
