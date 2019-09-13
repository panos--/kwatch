// import * as term from "term";
import * as blessed from "blessed";
import * as k8s from "@kubernetes/client-node";
import { K8sClient } from "./lib/client";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const client = new K8sClient(kc);

// (async function () {
//     console.log(await client.getPod("exim-smarthost-0", "system"));
// })();

const screen = blessed.screen({
    smartCSR: true,
    log: process.env.HOME + "/blessed-terminal.log",
    fullUnicode: true,
    dockBorders: true,
    ignoreDockContrast: true
});

const term = blessed.terminal({
    parent: screen,
    label: "Terminal",
    shell: "kubectl",
    args: ["-n", "system", "exec", "-it", "exim-smarthost-0", "-c", "exim-smarthost", "--", "bash", "-il"],
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    mouse: true,
    keys: true,
    border: "line",
    scrollbar: {
        ch: " ",
        track: {
            bg: "cyan"
        },
        style: {
            inverse: true
        }
    },
    style: {
        item: {
            hover: {
                bg: "blue",
                fg: "white",
            }
        },
        selected: {
            bg: "blue",
            fg: "white",
            bold: true
        },
    },
});

term.on("exit", () => {
    // console.log("exited");
    term.write("Finished. Enter to close.");
    term.key("enter", () => {
        term.kill();
        screen.destroy();
        process.exit(0);
    });
});

screen.key("C-q", function() {
    term.kill();
    return screen.destroy();
});

term.focus();
screen.render();
