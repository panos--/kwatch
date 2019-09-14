import * as blessed from "blessed";

const screen = blessed.screen({
    smartCSR: true,
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
screen.key(["q", "C-c"], (ch, key) => {
    return process.exit(0);
});

const colorBox = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    height: "100%",
    width: "100%",
    mouse: true,
    keys: true,
    border: "line",
    scrollable: true,
    alwaysScroll: true,
    scrollbar:  {
        ch: " ",
        track: {
            bg: "cyan"
        },
        style: {
            inverse: true
        }
    },
});
colorBox.key("pageup", () => {
    colorBox.scroll(-(colorBox.height - 2 | 0) || -1);
    screen.render();
});
colorBox.key("pagedown", () => {
    colorBox.scroll(colorBox.height - 2 | 0 || 1 );
    screen.render();
});
for (let i = 0; i < 256; i++) {
    const line = blessed.box({top: i, left: 0, height: 1, width: "100%"});
    line.style.bg = i;
    line.width = 40;
    line.setText(`Background Color: ${i}`);
    colorBox.append(line);
    const fgline = blessed.box({top: i, left: 45, height: 1, width: "100%"});
    fgline.style.fg = i;
    fgline.width = 100;
    fgline.setText(`Foreground Color: ${i}`);
    colorBox.append(fgline);
}

screen.append(colorBox);
colorBox.focus();
screen.render();
