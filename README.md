# kwatch

[![GitHub version](https://badge.fury.io/gh/panos--%2Fkwatch.svg)](https://badge.fury.io/gh/panos--%2Fkwatch)
[![npm version](https://badge.fury.io/js/kwatch.svg)](https://badge.fury.io/js/kwatch)
![CI Status](https://github.com/panos--/kwatch/workflows/Node%20CI/badge.svg)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

A terminal UI for watching, inspecting and interacting with Kubernetes clusters.

![kwatch demo](demo/demo.gif)

## Motivation

Tired of running `watch kubectl get pods` after applying some changes? Tired
of waiting for command completion when using `kubectl`?

This project's goal is to provide a terminal-based user interface around
`kubectl` and kubernetes' API that is quick and convenient to work with,
supporting most of the commonly used actions when interacting with a kubernetes
cluster.

The focus thereby is on interaction with and inspection and manipulation of
existing resources instead of on creating new resources as there are better
ways to accomplish the latter.

## Installation

`kwatch` is available as a standalone executable or as an `npm` package.

### Prerequisites

Please ensure you have `kubectl` installed somewhere in your `$PATH` and
configured it correctly.

### NPM

`kwatch` requires [Node.js](https://nodejs.org/) version 10. If you have
this installed you can easily install `kwatch` using the following command:

```shell
npm install -g kwatch
```

### Standalone Executable

If you do not have [Node.js](https://nodejs.org/) installed you can instead
download a standalone executable of `kwatch` from this project's
[releases page](https://github.com/panos--/kwatch/releases).

Extract the downloaded archive and put the `kwatch` binary somewhere in
your `$PATH`.

## Launch

After installation launch the program using the following command:

```shell
kwatch
```

Or if you are using a dark color scheme in your terminal, use dark mode:

```shell
kwatch -c dark
```

## How to Use

The main user interface component is the resource list which shows the resouces
of the type selected in the left pane, the api list, in the currently active
kubernetes context and namespace.

Navigate the list using `UP` and `DOWN` keys, search in the list by pressing `/`
which activates typeahead find.

Pressing `ENTER` on a resource shows a menu containing actions which can be
run on the selected resource.

Switch between the resource list and the api list by using `TAB`. The api list
as well as most menus can be filtered by typing a search term.

To change the current context (as in `kubectl config use-context ...`) press
`c`. To change the current namespace press `n`.

For a reference of available keyboard shortcuts press `h`.

To quit `kwatch` press `q`.

For the global shortcuts (like `q`, `h`, `c`, etc.) to be effective the
resource list must be focused.

## Status

This project is in an early development phase. Nevertheless it is already quite
usable. The main focus has been on designing the user interface. Only a few of
the most common actions on resources have been implemented yet.

Actions implemented so far:

* all
  * describe
  * show yaml
  * delete
  * force delete
* pods
  * exec bash
  * exec login bash
  * exec shell
  * exec login shell
  * exec command
  * view log
  * tail log
* secrets
  * show
  * dump

`kwatch` has been tested on systems running Linux and Windows Subsystem for
Linux, using Gnome Terminal, MinTTY and tmux against on-premise kubernetes
clusters (kubeadm) and DOKS kubernetes clusters (versions 1.12, 1.13, 1.14).

## Contribute

Please report bugs using [Github issues](https://github.com/panos--/kwatch/issues).

Pull requests are always welcome. Please follow the
[Angular Commit Message Guidelines](https://github.com/angular/angular/blob/master/CONTRIBUTING.md#commit)
(where scope specifies affected components in this project's context instead of
the ones defined there). The commit messages are used by
[semantic-release](https://github.com/semantic-release/semantic-release)
to decide on release version numbers and to generate changelogs.

## License

This software is distributed under the
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0),
see [LICENSE](LICENSE) for more information.
