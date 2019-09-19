import { V1Namespace } from "@kubernetes/client-node";
import { ExecAction } from "./exec_action";
import { AppContext } from "../app_context";

export class ExecBashAction extends ExecAction {
    public getLabel() {
        return "Exec Bash";
    }

    protected executeCommand(ctx: AppContext, namespace: V1Namespace, resource: string, container: string,
        executeCallback: (command: string, args?: string[]) => void): void {
        executeCallback("bash");
    }
}
