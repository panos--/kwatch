import { V1Namespace } from "@kubernetes/client-node";
import { ExecAction } from "./exec_action";
import { AppContext } from "../app_context";

export class ExecCommandAction extends ExecAction {
    public getLabel() {
        return "Exec Command...";
    }

    protected executeCommand(ctx: AppContext, namespace: V1Namespace, resource: string, container: string,
        executeCallback: (command: string, args?: string[], wait?: boolean) => void): void {
        const prompt = ctx.widgetFactory.prompt({
            parent: ctx.screen,
            label: "Enter command",
            width: 50,
        });
        prompt.focus();
        prompt.input("Command:", "", (err, value) => {
            if (err) {
                ctx.screen.log(err);
                return;
            }
            if (value === null) {
                return;
            }
            let cmdString = value.trim();
            if (cmdString.length == 0) {
                return;
            }
            // TODO: sensible split with shell-like syntax (i.e. double/single quotes)
            // cannot simply exec shell and pass command as single string since containers
            // might not even have a shell
            let [command, ...args] = cmdString.split(/\s+/);
            executeCallback(command, args, true);
        });
    }
}
