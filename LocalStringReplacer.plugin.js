/**
 * @name LocalStringReplacer
 * @author dora743
 * @version 0.1.0
 * @description Replace specific strings only on your local Discord display.
 */

module.exports = class LocalStringReplacer {
    constructor() {
        this.observer = null; 
        this.originals = new Map();
        this.queue = new Set();
        this.raf = null;


        this.MESSAGE_ONLY = true;

        this.replacements = [
            {
                from: "",
                to: "",
                caseSensitive: false
            },
            {
                from: "",
                to: "",
                caseSensitive: false
            }
        ];
    }

    start() {
        this.scan(document.body);

        this.observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "characterData") {
                    this.schedule(mutation.target);
                }

                for (const node of mutation.addedNodes) {
                    this.schedule(node);
                }
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        BdApi.UI.showToast("LocalStringReplacer enabled", {type: "success"});
    }

    stop() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        if (this.raf) {
            cancelAnimationFrame(this.raf);
            this.raf = null;
        }

        for (const [node, original] of this.originals.entries()) {
            if (node && node.isConnected) {
                node.data = original;
            }
        }

        this.originals.clear();
        this.queue.clear();

        BdApi.UI.showToast("LocalStringReplacer disabled", {type: "info"});
    }

    schedule(node) {
        if (!node) return;

        this.queue.add(node);

        if (this.raf) return;

        this.raf = requestAnimationFrame(() => {
            const targets = Array.from(this.queue);
            this.queue.clear();
            this.raf = null;

            for (const target of targets) {
                this.scan(target);
            }
        });
    }

    scan(root) {
        if (!root) return;

        if (root.nodeType === Node.TEXT_NODE) {
            this.applyToTextNode(root);
            return;
        }

        if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
            return;
        }

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    return this.shouldProcess(node)
                        ? NodeFilter.FILTER_ACCEPT
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            this.applyToTextNode(node);
        }
    }

    shouldProcess(textNode) {
        if (!textNode || !textNode.data || !textNode.data.trim()) return false;

        const parent = textNode.parentElement;
        if (!parent) return false;

        if (
            parent.closest(
                'textarea, input, [contenteditable="true"], [role="textbox"]'
            )
        ) {
            return false;
        }

        if (parent.closest("script, style, code, pre")) {
            return false;
        }

        if (!this.MESSAGE_ONLY) return true;

        return Boolean(
            parent.closest(
                '[id^="message-content-"], [class*="messageContent"], [class*="markup"]'
            )
        );
    }

    applyToTextNode(node) {
        if (!this.shouldProcess(node)) return;

        const knownOriginal = this.originals.get(node);

        if (knownOriginal !== undefined) {
            const expected = this.replaceAll(knownOriginal);
            if (node.data !== expected) {
                this.originals.set(node, node.data);
            }
        } else {
            this.originals.set(node, node.data);
        }

        const original = this.originals.get(node);
        const replaced = this.replaceAll(original);

        if (replaced === original) {
            this.originals.delete(node);
            return;
        }

        if (node.data !== replaced) {
            node.data = replaced;
        }
    }

    replaceAll(text) {
        let result = text;

        for (const rule of this.replacements) {
            if (!rule.from) continue;

            if (rule.caseSensitive) {
                result = result.split(rule.from).join(rule.to);
            } else {
                const escaped = this.escapeRegExp(rule.from);
                result = result.replace(new RegExp(escaped, "gi"), rule.to);
            }
        }

        return result;
    }

    escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
};
