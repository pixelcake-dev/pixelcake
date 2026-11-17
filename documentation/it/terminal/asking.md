---
title: "Domande: ping, trace e gli altri"
description: "I comandi che fanno una domanda alla rete e seguono la risposta sul canvas: ping, trace, browse, mail, download, resolve."
order: 7
---

> [!TODO]
> Una pagina di riferimento: seguire terminal/interfaces-and-vlans.md. Per ognuno, un successo e un fallimento.

## ping {#ping}

```text
ping <target> [from <device>]
```

> [!TODO]
> Richiesta e risposta, nei due sensi.

## trace {#trace}

```text
trace <target> [from <device>] [as ping|web|email|dns]
traceroute <target> [from <device>]
tracert <target> [from <device>]
```

> [!TODO]
> In un senso, salto per salto, con ciò che ha fatto ogni dispositivo; as <servizio>.

## browse {#browse}

```text
browse <target> [from <device>]
web <target> [from <device>]
curl <target> [from <device>]
```

> [!TODO]
> Uno scambio web completo.

## mail {#mail}

```text
mail <target> [from <device>]
email <target> [from <device>]
```

> [!TODO]
> Un'email attraverso il suo relay; la modalità email del progetto.

## download {#download}

```text
download <target> [from <device>]
wget <target> [from <device>]
```

> [!TODO]
> Richiesta, poi i dati.

## resolve {#resolve}

```text
resolve <name> [from <device>]
lookup <name> [from <device>]
nslookup <name> [from <device>]
```

> [!TODO]
> Una richiesta DNS da sola.

## Le destinazioni {#targets}

> [!TODO]
> Un dispositivo, un indirizzo (quello mirato), un nome host risolto prima; dietro un NAT.
