# tempit
Easy Module Management

### Prerequisites
The only thing needed is [Node.js](https://nodejs.org/) to be installed in your system.

### Installing
Installing tempit is easy, just run the following command

```
npm install tempit -g
```

# Usage
View Help
```
tempit help
```

## Version
```
tempit -v
```

## Initialize directory
This will create a **.tempit** file in the current directory. The tempit file is basically a JSON file.
```
tempit init
```

## Add Module
```
tempit add module_name file1 file2 folder1 folder2
```

## Start Tempit Server For Sharing
```
tempit start
```

## Fetch From A Tempit Server
To fetch from **localhost**,
```
tempit fetch localhost module_name
```
To fetch all modules, just run
```
tempit fetch localhost
```