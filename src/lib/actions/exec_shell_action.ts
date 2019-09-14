import * as blessed from "blessed";
import { V1Namespace } from "@kubernetes/client-node";
import { ExecAction } from "./exec_action";

export class ExecShellAction extends ExecAction {
    public getLabel() {
        return "Exec Shell";
    }

    protected executeCommand(screen: blessed.Widgets.Screen, namespace: V1Namespace, resource: string, container: string,
        executeCallback: (command: string, args?: string[]) => void): void {
        executeCallback("sh");
    }
}
