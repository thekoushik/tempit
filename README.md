# TempIt

Simple Online Temporary Storage App

## Getting Started

First, create your [**TempIt**](https://tempit-thekoushik.rhcloud.com/) account, and thats it!

### Prerequisites

The only thing needed is [Node.js](https://nodejs.org/) to be installed in your system.

### Installing

Installing tempit is easy, just run the following command

```
npm install tempit -g
```

## Usage

From anywhere in your system, open terminal/cmd and enter the following command
```
tempit set
```
This will prompt you to enter your tempit email and password. After that, you will never have to login again from your system, tempit will save your MAC address. You may run this command from a different machine, and login there again, but if you want to remove a machine from your account, just run the command
```
tempit reset
```
To upload the content of the current directory, run
```
tempit up
```
(*Any previous upload will be discarded*)

and when you need it back, run
```
tempit down
```

**Commands:**
```
tempit <command>

where <command> is one of:
    set, reset, up, down, help

tempit set [name]   add this machine to your tempit account (Login required)
tempit reset        remove this machine from your tempit account
tempit up           upload the content of current directory
tempit down         download previous upload to current directory
tempit help         view this help
```

## Tech

Tempit uses a number of open source projects to work properly:

* [node.js]
* [superagent]
* [getmac]
* [tar]
* [tmp]
* [readline-sync]
* [is-reachable]
* [chalk]
* [progress]
* [fstream]

## Author

* **Koushik Seal** - [thekoushik](https://github.com/thekoushik)

## License

This project is licensed under the MIT License

## Acknowledgments

* Hat tip to anyone who's code was used
* Inspiration
* etc
