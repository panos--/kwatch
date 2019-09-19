import { Action } from "./action";
import { APIResource, K8sClient } from "../client";
import * as blessed from "blessed";
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
        }, reason => {
            // FIXME: Handle error
            console.log(reason);
        }).catch(reason => {
            // FIXME: Handle error
            console.log(reason);
        });
    };

    private executeCommand(ctx: AppContext, namespace: V1Namespace, resource: string, container: string) {
        const commandArray = ["kubectl", "-n", namespace.metadata.name, "logs", "--tail=1000", "-c", container, resource]
            .map(arg => { return `"${arg.replace("\"", "\\\"")}"`; });
        commandArray.push("|");
        // TODO: generalize or make configurable
        commandArray.push("pager");
        const command = commandArray.join(" ");
        ctx.screen.log("running log view: sh -c '" + command + "'");

        const shellCommand = "sh";
        const shellArgs = ["-c", command];
        BlessedUtils.executeCommand(ctx.screen, shellCommand, shellArgs, (err: any, success: boolean) => {
            if (err) {
                console.log(err);
            }
            if (!success) {
                console.log("Command returned with non-zero exit code");
            }
        });
    }
}
