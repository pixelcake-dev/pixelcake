// PixelCake documentation: the little the pages do by themselves.
// Loaded in the head, so that a page is never painted in the wrong theme
// first, and a first visit that belongs on the Italian home goes there before
// anything is shown. It asks nothing of any other host.
(function () {
    'use strict';

    var THEME_KEY = 'pixelcake-docs-theme';
    var LANGUAGE_KEY = 'pixelcake-docs-language';
    // (what the app, on the same address, remembers: read, never written)
    var APP_UI_KEY = 'pixelcake-ui-v1';
    var APP_LANGUAGE_KEY = 'pixelcake-language';
    var root = document.documentElement;

    function read(key) {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            // The choice lasts for this page only
        }
    }

    // --- The language. The English home sends a first visit on to the Italian
    // one when the visitor chose Italian (here or in the app) or, choosing
    // nothing, has a browser that puts Italian before English. Nobody is moved
    // while going from one page of the documentation to another.

    function prefersItalian() {
        var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
        for (var i = 0; i < list.length; i++) {
            var code = String(list[i]).toLowerCase();
            if (code === 'it' || code.indexOf('it-') === 0) return true;
            if (code === 'en' || code.indexOf('en-') === 0) return false;
        }
        return false;
    }

    function fromHere() {
        try {
            return !!document.referrer && new URL(document.referrer).host === location.host;
        } catch (error) {
            return false;
        }
    }

    var italianHome = root.getAttribute('data-italian-home');
    if (italianHome) {
        var chosen = read(LANGUAGE_KEY) || read(APP_LANGUAGE_KEY);
        if (chosen === 'it' || (chosen !== 'en' && !fromHere() && prefersItalian())) {
            location.replace(italianHome + location.hash);
            return;
        }
    }

    // --- Light or dark: the choice made here, else the theme of the app, else
    // the one of the computer.

    function savedTheme() {
        var value = read(THEME_KEY);
        if (value === 'light' || value === 'dark') return value;
        try {
            var app = JSON.parse(read(APP_UI_KEY) || 'null');
            var dark = app && app.state && app.state.darkMode;
            if (dark === true) return 'dark';
            if (dark === false) return 'light';
        } catch (error) {
            // (nothing the app said that can be read)
        }
        return null;
    }

    function currentTheme() {
        return (
            root.getAttribute('data-theme') ||
            (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        );
    }

    var theme = savedTheme();
    if (theme) root.setAttribute('data-theme', theme);
    root.classList.add('js');

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // --- small things

    var toastTimer = null;
    function toast(text) {
        var box = document.querySelector('.toast');
        if (!box) return;
        box.textContent = text;
        box.classList.add('shown');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            box.classList.remove('shown');
        }, 1600);
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        return new Promise(function (resolve, reject) {
            var area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            var done = false;
            try {
                done = document.execCommand('copy');
            } catch (error) {
                done = false;
            }
            document.body.removeChild(area);
            if (done) resolve();
            else reject(new Error('copy'));
        });
    }

    function themeButton() {
        var button = document.querySelector('.theme-toggle');
        if (!button) return;
        // The button names the theme it leads to
        function label() {
            var dark = currentTheme() === 'dark';
            button.textContent = dark ? button.getAttribute('data-light') : button.getAttribute('data-dark');
            button.setAttribute('aria-label', dark ? button.getAttribute('data-to-light') : button.getAttribute('data-to-dark'));
        }
        button.addEventListener('click', function () {
            var next = currentTheme() === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            write(THEME_KEY, next);
            label();
        });
        label();
    }

    function languageSwitch() {
        Array.prototype.forEach.call(document.querySelectorAll('.lang a[hreflang]'), function (link) {
            link.addEventListener('click', function () {
                write(LANGUAGE_KEY, link.getAttribute('hreflang'));
            });
        });
    }

    // --- The navigation on a narrow screen: opened from the masthead

    function menu() {
        var button = document.querySelector('.menu-toggle');
        var sidebar = document.getElementById('sidebar');
        if (!button || !sidebar) return;
        function set(open) {
            root.classList.toggle('nav-open', open);
            button.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
        button.addEventListener('click', function () {
            var open = button.getAttribute('aria-expanded') !== 'true';
            set(open);
            if (open) {
                var current = sidebar.querySelector('[aria-current="page"]') || sidebar.querySelector('a');
                if (current) {
                    current.scrollIntoView({ block: 'center' });
                    current.focus();
                }
            }
        });
        sidebar.addEventListener('click', function (event) {
            if (event.target.closest('a')) set(false);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && root.classList.contains('nav-open')) {
                set(false);
                button.focus();
            }
        });
        window.matchMedia('(min-width: 901px)').addEventListener('change', function () {
            set(false);
        });
    }

    // --- Copy: the code of a block, the commands of a terminal example, the link of a heading

    function copyButtons() {
        Array.prototype.forEach.call(document.querySelectorAll('.copy'), function (button) {
            var idle = button.textContent;
            button.addEventListener('click', function () {
                copyText(button.getAttribute('data-copy') || '').then(function () {
                    button.textContent = button.getAttribute('data-copied');
                    button.classList.add('done');
                    setTimeout(function () {
                        button.textContent = idle;
                        button.classList.remove('done');
                    }, 1500);
                }, function () {});
            });
        });
        Array.prototype.forEach.call(document.querySelectorAll('.anchor'), function (link) {
            link.addEventListener('click', function () {
                var address = new URL(link.getAttribute('href'), location.href).href;
                copyText(address).then(function () {
                    toast(link.getAttribute('data-copied'));
                }, function () {});
            });
        });
    }

    // --- Where the reader is, in the table of contents

    function tocFollows() {
        var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
        if (!links.length || !('IntersectionObserver' in window)) return;
        var headings = links
            .map(function (link) {
                return document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
            })
            .filter(Boolean);
        function update() {
            var current = headings[0];
            for (var i = 0; i < headings.length; i++) {
                if (headings[i].getBoundingClientRect().top < window.innerHeight * 0.3) current = headings[i];
            }
            links.forEach(function (link) {
                link.classList.toggle('is-current', link.getAttribute('href') === '#' + current.id);
            });
        }
        var pending = false;
        window.addEventListener(
            'scroll',
            function () {
                if (pending) return;
                pending = true;
                requestAnimationFrame(function () {
                    pending = false;
                    update();
                });
            },
            { passive: true }
        );
        update();
    }

    // --- Videos and animations: they move by themselves only for who has not
    // asked for less motion, and only while they are in view; a button pauses
    // and plays them

    var PLAY_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>';
    var PAUSE_ICON = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2h3v10H3zM8 2h3v10H8z" fill="currentColor"/></svg>';

    function toggleButton(holder, playLabel, pauseLabel) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'media-toggle';
        holder.appendChild(button);
        return function show(playing) {
            button.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
            button.setAttribute('aria-label', playing ? pauseLabel : playLabel);
            button.title = playing ? pauseLabel : playLabel;
        };
    }

    function videos() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-video]'), function (holder) {
            var video = holder.querySelector('video');
            if (!video) return;
            video.removeAttribute('controls');
            var show = toggleButton(holder, holder.getAttribute('data-play'), holder.getAttribute('data-pause'));
            var heldByUser = false;
            function play() {
                video.preload = 'auto';
                var promise = video.play();
                if (promise && promise.catch) promise.catch(function () {});
            }
            video.addEventListener('play', function () {
                show(true);
            });
            video.addEventListener('pause', function () {
                show(false);
            });
            holder.querySelector('.media-toggle').addEventListener('click', function () {
                if (video.paused) {
                    heldByUser = false;
                    play();
                } else {
                    heldByUser = true;
                    video.pause();
                }
            });
            show(false);
            if (reduceMotion.matches || !('IntersectionObserver' in window)) return;
            new IntersectionObserver(
                function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting && !heldByUser) play();
                        else if (!entry.isIntersecting && !video.paused) video.pause();
                    });
                },
                { threshold: 0.5 }
            ).observe(video);
        });
    }

    function animations() {
        Array.prototype.forEach.call(document.querySelectorAll('img[data-animation]'), function (image) {
            var moving = image.getAttribute('src');
            var still = image.getAttribute('data-poster');
            var show = toggleButton(image.parentNode, image.getAttribute('data-play'), image.getAttribute('data-pause'));
            var playing = !reduceMotion.matches;
            function set(play) {
                playing = play;
                image.setAttribute('src', play ? moving : still);
                show(play);
            }
            image.parentNode.querySelector('.media-toggle').addEventListener('click', function () {
                set(!playing);
            });
            set(playing);
        });
    }

    // --- Search: an index of the pages of this language, read once, and a
    // window that lists what matches as it is typed

    function fold(text) {
        return String(text)
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase();
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
    }

    /** The words of a text with the terms marked; folded the same way as the search */
    function marked(text, terms) {
        var folded = fold(text);
        var spans = [];
        terms.forEach(function (term) {
            var at = 0;
            while ((at = folded.indexOf(term, at)) !== -1) {
                spans.push([at, at + term.length]);
                at += term.length;
            }
        });
        spans.sort(function (a, b) {
            return a[0] - b[0];
        });
        var html = '';
        var last = 0;
        spans.forEach(function (span) {
            if (span[0] < last) return;
            html += escapeHtml(text.slice(last, span[0])) + '<mark>' + escapeHtml(text.slice(span[0], span[1])) + '</mark>';
            last = span[1];
        });
        return html + escapeHtml(text.slice(last));
    }

    function snippet(text, terms) {
        var folded = fold(text);
        var first = -1;
        terms.forEach(function (term) {
            var at = folded.indexOf(term);
            if (at !== -1 && (first === -1 || at < first)) first = at;
        });
        if (first === -1) return text.slice(0, 160) + (text.length > 160 ? '…' : '');
        var start = Math.max(0, first - 60);
        var end = Math.min(text.length, start + 180);
        return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    }

    function search() {
        var dialog = document.querySelector('.search-dialog');
        var opener = document.querySelector('.search-open');
        if (!dialog || !opener || typeof dialog.showModal !== 'function') {
            if (opener) opener.style.display = 'none';
            return;
        }
        var input = dialog.querySelector('.search-input');
        var status = dialog.querySelector('.search-status');
        var list = dialog.querySelector('.search-results');
        var words = JSON.parse(dialog.getAttribute('data-words'));
        var base = dialog.getAttribute('data-root');
        var entries = null;
        var loading = null;

        function load() {
            if (!loading) {
                loading = fetch(dialog.getAttribute('data-index'))
                    .then(function (response) {
                        if (!response.ok) throw new Error(String(response.status));
                        return response.json();
                    })
                    .then(function (index) {
                        entries = index.entries.map(function (entry) {
                            return {
                                entry: entry,
                                title: fold(entry.t),
                                heading: fold(entry.h),
                                section: fold(entry.s),
                                text: fold(entry.x),
                            };
                        });
                    });
            }
            return loading;
        }

        function score(item, terms) {
            var total = 0;
            for (var i = 0; i < terms.length; i++) {
                var term = terms[i];
                var points = 0;
                if (item.title.indexOf(term) !== -1) points += 8;
                if (item.heading.indexOf(term) !== -1) points += 6;
                if (item.section.indexOf(term) !== -1) points += 1;
                if (item.text.indexOf(term) !== -1) points += 2;
                if (points === 0) return 0;
                total += points;
            }
            // (a page itself before its sections, when both match as well)
            return total + (item.heading ? 0 : 1);
        }

        function run() {
            var query = input.value.trim();
            var terms = fold(query)
                .split(/[^a-z0-9.\-/]+/)
                .filter(function (term) {
                    return term.length > 0;
                });
            list.innerHTML = '';
            if (query.length < 2 || terms.length === 0) {
                status.textContent = words.hint;
                return;
            }
            if (!entries) {
                status.textContent = words.loading;
                load().then(run, function () {
                    status.textContent = words.failed;
                });
                return;
            }
            var found = entries
                .map(function (item) {
                    return { item: item, score: score(item, terms) };
                })
                .filter(function (result) {
                    return result.score > 0;
                })
                .sort(function (a, b) {
                    return b.score - a.score;
                })
                .slice(0, 30);
            status.textContent =
                found.length === 0
                    ? words.none.replace('{q}', query)
                    : found.length === 1
                      ? words.one
                      : words.many.replace('{n}', String(found.length));
            list.innerHTML = found
                .map(function (result) {
                    var entry = result.item.entry;
                    var title = entry.h ? entry.t + ' — ' + entry.h : entry.t;
                    return (
                        '<li><a href="' + escapeHtml(base + entry.u) + '">' +
                        '<span class="result-title">' + marked(title, terms) + '</span>' +
                        (entry.s ? '<span class="result-crumb">' + escapeHtml(entry.s) + '</span>' : '') +
                        '<span class="result-text">' + marked(snippet(entry.x, terms), terms) + '</span>' +
                        '</a></li>'
                    );
                })
                .join('');
        }

        function open() {
            if (dialog.open) return;
            dialog.showModal();
            input.focus();
            input.select();
            load().catch(function () {});
            run();
        }

        opener.addEventListener('click', open);
        dialog.querySelector('.search-close').addEventListener('click', function () {
            dialog.close();
        });
        // A click on the dim around the window closes it
        dialog.addEventListener('click', function (event) {
            if (event.target === dialog) dialog.close();
        });
        dialog.addEventListener('close', function () {
            opener.focus();
        });
        input.addEventListener('input', run);
        // Down from the field goes to the results, up and down among them
        dialog.addEventListener('keydown', function (event) {
            var links = Array.prototype.slice.call(list.querySelectorAll('a'));
            var at = links.indexOf(document.activeElement);
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (links.length) links[Math.min(at + 1, links.length - 1)].focus();
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (at <= 0) input.focus();
                else links[at - 1].focus();
            } else if (event.key === 'Enter' && document.activeElement === input && links.length) {
                event.preventDefault();
                links[0].click();
            }
        });
        list.addEventListener('click', function (event) {
            var link = event.target.closest('a');
            if (!link) return;
            // An anchor of this very page: the window closes, the page scrolls
            var target = new URL(link.href);
            if (target.pathname === location.pathname) dialog.close();
        });
        document.addEventListener('keydown', function (event) {
            var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
            if ((event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) {
                event.preventDefault();
                open();
            }
        });
    }

    // --- While writing (pnpm docs:dev): the page reloads when the documentation is built again

    function devReload() {
        var address = root.getAttribute('data-dev-reload');
        if (!address || !('EventSource' in window)) return;
        new EventSource(address).onmessage = function (event) {
            if (event.data === 'reload') location.reload();
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        themeButton();
        languageSwitch();
        menu();
        copyButtons();
        tocFollows();
        videos();
        animations();
        search();
        devReload();
    });
})();
