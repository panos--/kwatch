import { Action } from "./action";
import { APIResource } from "../api_resource";
import { V1Namespace } from "@kubernetes/client-node";
import { ContainerPicker } from "../widgets/container_picker";
import { BlessedUtils } from "../blessed_utils";
import { AppContext } from "../app_context";

export class ViewLogAction implements Action {
    public getLabel() {
        return "View logs";
    }

    public appliesTo(apiResource: APIResource) {
        return apiResource.resource.name == "pods";
    }

    public execute(ctx: AppContext, namespace: V1Namespace, apiResource: APIResource, resource: string) {
        ctx.client.getPod(resource, namespace.metadata.name).then(pod => {
            let containers = pod.spec.containers.map(container => { return container.name; });
            if (containers.length == 0) {
                // should not happen
                throw "no containers found in pod";
            }
            else if (containers.length == 1) {
                this.executeCommand(ctx, namespace, resource, containers[0]);
            }
            else {
                const containerPicker = new ContainerPicker(ctx, containers, ctx.screen);
                containerPicker.onSelect(container => {
                    this.executeCommand(ctx, namespace, resource, container);
                });
                containerPicker.show();
            }
        }).catch(reason => {
            ctx.widgetFactory.error(
                `Error retrieving data of pod ${resource}\n\n`
                + `Reason: ${reason}`
            );
        });
    };

    private executeCommand(ctx: AppContext, namespace: V1Namespace, resource: string, container: string) {
        const commandArray = ["kubectl", "-n", namespace.metadata.name, "logs", "--tail=1000", "-c", container, resource]
            .map(arg => { return `"${arg.replace(/"/g, "\\\"")}"`; });
        commandArray.push("|");
        commandArray.push(`"${ctx.pager.replace(/"/g, "\\\"")}"`);
        const command = commandArray.join(" ");
        ctx.screen.log("running log view: sh -c '" + command + "'");

        const shellCommand = "sh";
        const shellArgs = ["-c", command];
        BlessedUtils.executeCommand(ctx.screen, shellCommand, shellArgs, (err?: Error, success?: boolean) => {
            if (err) {
                ctx.widgetFactory.error(
                    "Error retrieving logs\n\n"
                    + `Reason: ${err.message}`
                );
            }
            else if (!success) {
                ctx.widgetFactory.error(
                    "Error retrieving logs\n\n"
                    + "Command returned with non-zero exit code"
                );
            }
        });
    }
}
