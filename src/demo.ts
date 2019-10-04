import * as pty from "node-pty";
import { IPty } from "node-pty";

interface ScriptAction {
    execute(out: IPty, resolve: () => void): void;
}

class SendAction implements ScriptAction {
    private data: string;

    public constructor(data: string) {
        this.data = data;
    }

    public execute(out: IPty, resolve: () => void): void {
        out.write(this.data);
        resolve();
    }
}

class SleepAction implements ScriptAction {
    private duration: number;

    public constructor(duration: number) {
        this.duration = duration;
    }

    public execute(out: IPty, resolve: () => void): void {
        setTimeout(() => {
            resolve();
        }, this.duration);
    }
}

class Script {
    private out: IPty;
    private actions: ScriptAction[] = [];

    public constructor(out: IPty) {
        this.out = out;
        return this;
    }

    public static build(out: IPty): Script {
        return new Script(out);
    }

    public send(data: string) {
        this.actions.push(new SendAction(data));
        return this;
    }

    public sendKey(key: string) {
        return this.send(key).waitHuman();
    }

    public sendKeys(keys: string[]) {
        for (let key of keys) {
            this.sendKey(key).waitHuman();
        }
        return this;
    }

    public sendText(text: string) {
        for (let c of text) {
            this.send(c).waitHuman();
        }
        return this;
    }

    public wait(duration: number) {
        this.actions.push(new SleepAction(duration));
        return this;
    }

    public waitHuman() {
        return this.wait(100);
    }

    public async run() {
        for (let action of this.actions) {
            await (() => {
                return new Promise<void>(resolve => {
                    action.execute(this.out, resolve);
                });
            })();
        }
    }
}

const Keys = {
    ESC: "\x1b",
    RETURN: "\r",
    TAB: "\t",
    UP: "\x1b[A",
    DOWN: "\x1b[B",
    HOME: "\x1b[1~",
    END: "\x1b[4~",
    PAGEUP: "\x1b[5~",
    PAGEDOWN: "\x1b[6~",
};

const child = pty.spawn("node", ["dist/main.js", "-c", "dark"], {
    name: "xterm-256color",
    cols: process.stdout.columns,
    rows: process.stdout.rows,
    cwd: process.cwd(),
    env: process.env
});
child.on("data", data => {
    process.stdout.write(data);
});

// Script.build(child.stdin)
Script.build(child)
    .wait(2500)

    // choose context
    .send("c").wait(500)
    .sendText("kuad").wait(200)
    .send(Keys.RETURN).wait(2000)

    // choose namespace
    .send("n").wait(500)
    .sendText("sys").wait(500)
    .send(Keys.DOWN).wait(500)
    .send(Keys.RETURN).wait(1000)

    // choose pods
    .sendKey(Keys.TAB).wait(500)
    .sendText("pods").wait(200)
    .sendKey(Keys.RETURN).wait(1000)

    // search
    .send("/").wait(500)
    .sendText("nfs").wait(500)
    .sendKey(Keys.DOWN).wait(500)
    .sendKey(Keys.ESC).wait(500)

    // describe
    .sendKey(Keys.RETURN).wait(500)
    .sendKey(Keys.RETURN).wait(500)
    .sendKeys([
        Keys.DOWN, Keys.DOWN, Keys.DOWN, Keys.PAGEDOWN,
    ]).wait(500)
    .sendKey(Keys.ESC).wait(500)

    // exec shell
    .sendKey(Keys.RETURN).wait(500)
    .sendText("she").wait(500)
    .sendKey(Keys.RETURN).wait(1000)
    .sendText("exit").wait(500)
    .sendKey(Keys.RETURN).wait(1000)

    // exec login shell
    .sendKey(Keys.RETURN).wait(500)
    .sendText("loshe").wait(500)
    .sendKey(Keys.RETURN).wait(1000)
    .sendText("ls -l").wait(500)
    .sendKey(Keys.RETURN).wait(1000)
    .sendText("exit").wait(500)
    .sendKey(Keys.RETURN).wait(1000)

    // view exim logs
    .sendKey(Keys.HOME).wait(500)
    .sendKey("/").wait(500)
    .sendText("ex")
    .sendKey(Keys.ESC).wait(500)
    .sendKey(Keys.RETURN).wait(500)
    .sendText("v").wait(500)
    .sendKey(Keys.RETURN).wait(1000)
    .sendKey("G").wait(1000)
    .sendKey("q").wait(500)

    // delete exim pod
    .sendKey(Keys.DOWN).wait(300)
    .sendKey(Keys.RETURN).wait(500)
    .sendText("del").wait(500)
    .sendKey(Keys.RETURN).wait(1500)
    .sendKey(Keys.RETURN).wait(7000)

    // exit
    .wait(2000)
    .send("q").wait(1000)
    .run().then(() => {
        child.kill();
    });
