const express = require('express')
const re = require('rethinkdb')
const sGen = require('./build/Release/sudoku_generator.node')
const { uniqueNamesGenerator, adjectives, colors, animals, NumberDictionary } = require('unique-names-generator');
const webSocket = require('ws')

const api = express()
const wss = new webSocket.Server({ noServer: true })
const port = process.env.PORT || '8080';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || 32769;

// DB initialization

var connection = null;
re.connect({ host: dbHost, port: dbPort }, async (err, conn) => {
    if (err)
        throw err
    connection = conn
    if (!(await re.dbList().contains('sudoku').run(connection) && await re.db('sudoku').tableList().contains('boards').run(connection) && await re.db('sudoku').tableList().contains('lobbies').run(connection)))
        initDB()    // make sure to create all the needed db/tables before we start if one of them is missing

    connection.use('sudoku')
});

initDB = async () => {
    if (!await re.dbList().contains('sudoku').run(connection)) await re.dbCreate('sudoku').run(connection)
    if (!await re.db('sudoku').tableList().contains('boards').run(connection)) await re.tableCreate('boards').run(connection)   // Will store info about the boards
    if (!await re.db('sudoku').tableList().contains('lobbies').run(connection)) await re.tableCreate('lobbies', { primaryKey: 'name' }).run(connection) // Will store info about the lobbies (which basicly only allow to get which board you're playing on and having a easier to comunicate name)
}

// Handlers for the API

const newSudoku = async (difficulty, symmetry) => {
    // Create a new sudoku
    board = symmetry === undefined ? sGen.generateBoard(parseInt(difficulty)) : sGen.generateBoard(parseInt(difficulty), parseInt(symmetry)) // using qqwing wrapper
    result = await re.table('boards').insert({ board: board, difficulty: parseInt(difficulty) }, {returnChanges : true}).run(connection) // here we insert the board in db
    if (result.errors > 0)
        return { status: 400, result: { error: result.first_error } }

    return { status: 200, result: result.changes[0].new_val } // We're returning an object to be able to use it in WS API as well as in HTTP API (not always implemented tho)
}

const newLobby = async (id) => {
    result = await re.table('lobbies').insert({ name: uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals, NumberDictionary.generate()] }), board_id: id ? id : null }, { returnChanges: true }).run(connection)
    if (result.errors > 0)
        return { status: 400, result: { error: result.first_error } }

    return { status: 200, result: result.changes[0].new_val }
}

const update = async (cell, value, action, id, thing) => {
    cell = parseInt(cell);
    value = parseInt(value);

    // Stop is the request is not sane
    if (thing != 'cell' && thing != 'small') {
        return {status: 400, result : { error: "Invalid thing to update : must be 'cell' or 'small'" }}
    } else if (isNaN(cell) || (isNaN(value) && !(action == 'del' && thing == 'cell'))) {    // If we're deleting a cell, we don't need a value
        return {status: 400, result : { error: "Invalid cell or value : both must be integers" }};
    } else if (action != 'put' && action != 'del') {
        return {status: 400, result : { error: "Invalid action : must be 'put' or 'del'" }};
    } else if ((value < 1 || value > 9) && (action == 'del' && thing == 'cell')) {  // same here, if we're deleting a cell, we don't need a value
        return {status: 400, result : { error: "Invalid value : must be between 1 and 9" }};
    } else if (cell < 0 || cell > 80) {
        return {status: 400, result : { error: "Invalid cell : must be between 0 (top left) and 80 (buttom right)" }};
    }

    let result; // Just for it to be in scope
    if (thing == 'cell')
        result = await updateCell(id, action, cell, value)
    else if (thing == 'small')
        result = await updateSmall(id, action, cell, value)

    if (!result)
        return { status: 500, result: { error: "Unknown error" } }
    else if (result.errors > 0)
        return { status: 400, result: { error: result.first_error } }
    else if (result.skipped > 0)
        return { status: 400, result: { error: "Board not found" } }
    else
        return { status: 200, result: { changes: result.replaced, unchanges: result.unchanged } }
}

const updateCell = async (id, action, cell, value) => {
    if (action == 'put')
        return await re.table('boards').get(id)
            .update(function (board) {
                return re.branch(board('board')(cell).eq(0), // filter out cell that were already given by the original puzzle
                    { guesses: { [cell]: value } },
                    re.error("Cell is already given"));
            })
            .run(connection)

    else if (action == 'del')
        return await re.table('boards').get(id)
            .update({
                guesses: re.literal(re.row("guesses").without(String(cell))) // Literal make sure it doesn't merge but really remove the unwanted value
            })
            .run(connection)

    // if we didn't do anything, undefined will be returned, allowing to note that no action was done (eventho it wouldn't happend due to request sanitation done before)
};

const updateSmall = (id, action, cell, value) => {
    // Really close to updateCell
    if (action == 'put')
        return re.table('boards').get(id)
            .update(function (board) {
                return re.branch(board('board')(cell).ne(0),
                    re.error("Cell is already given"),
                    { small: { [cell]: board("small")(String(cell)).default([]).setInsert(value) } } // setInsert to stop duplicates
                )
            })
            .run(connection)

    else if (action == 'del')
        return re.table('boards').get(id)
            .update({ small: { [cell]: re.literal(re.row("small")(String(cell)).setDifference([value])) } })
            .run(connection)
}

const updateLobby = async (name, board_id) => {
    result = await re.table('lobbies').get(name).update({ board_id: board_id }).run(connection)
    if (result.errors > 0)
        return { status: 400, result: { error: result.first_error } }
    else if (result.skipped > 0)
        return { status: 400, result: { error: "Lobby not found" } }
    else
        return { status: 200, result: result.replaced == 1 ? "success" : "Nothing new (or something went wrong...)" }
}

// Handlers for the websockets

function wsBoard(trackers, board, ws) {
    if (trackers.board){
        console.log("Closing existing tracker for board")
        trackers.board.close((err) => {
            if (err)
                console.log(err);
        });} // Close a potentially existing other tracker for this object (affectively keeping from tracking multiple board)
    re.table('boards').get(board).changes({includeInitial : true}).run(connection, (err, cursor) => {
        if (err)
            console.log(err);
        trackers.board = cursor;
        console.log("Tracking board "+board);
        cursor.each((err, result) => {
            if (err)
                console.log(err);
            ws.send(JSON.stringify({board: result.new_val}));
            console.log("<board= "+JSON.stringify({lobby : result.new_val}));
        });
    });
}

function wsLobby(trackers, lobby, ws) {
    if (trackers.lobby){
        console.log("Closing existing tracker for lobby")
        trackers.lobby.close((err) => {
            if (err)
                console.log(err);
        });}
    re.table('lobbies').get(lobby).changes({includeInitial : true}).run(connection, (err, cursor) => {
        if (err)
            console.log(err);
        trackers.lobby = cursor;
        console.log("Tracking lobby "+lobby);
        cursor.each((err, result) => {
            if (err)
                console.log(err);
            ws.send(JSON.stringify({lobby : result.new_val}));
            console.log("<lobby= "+JSON.stringify({lobby : result.new_val}));
        });
    });
}

// Websocket binds

wss.on('connection', (ws, req) => {
    let trackers = {}
    ws.on('message', bindMessages(trackers, ws))

    ws.on('close', () => {
        console.log("Closing connection");
        if (trackers.board)
            trackers.board.close((err) => {
                if (err)
                    console.log(err);
            });
        if (trackers.lobby)
            trackers.lobby.close((err) => {
                if (err)
                    console.log(err);
            });
    })
})


function bindMessages(trackers, ws) {
    return (message) => {
        console.log("=> "+message);
        message = JSON.parse(message);

        if (message.type == 'join') {
            wsJoin(message, trackers, ws);
        } else if (message.type == 'update') {
            wsUpdate(message, ws);
        } else {
            ws.send(JSON.stringify({ error : "Unknown type : must be 'join' or 'update'" }))
        }
    };
}


function wsJoin(message, trackers, ws) {
    if (message.join == 'lobby') {
        wsLobby(trackers, message.lobby, ws);
    } else if (message.join == 'board') {
        wsBoard(trackers, message.board, ws);
    } else {
        ws.send(JSON.stringify({ error: "Invalid thing to join : can be 'board' or 'lobby'" }));
    }
}

function wsUpdate(message, ws) {
    if (message.update == 'lobby'){
        promise = updateLobby(message.lobby, message.board)
    } else {
        promise = update(message.cell, message.value, message.action, message.board, message.update)
    }
    if (promise)
        promise.then(result => {
            if(result.error || message.update != 'lobby') // If it's a lobby update, it'll be handled by the tracker
                ws.send(JSON.stringify({[message.update] : result.result}))
        }).catch(err => console.log(err))
}

// API binds

api.get('/new/sudoku/:difficulty/:symmetry?', (req, res) => { newSudoku(req.params.difficulty, req.params.symmetry).then(result => res.status(result.status).json(result.result)) })
    .get('/new/lobby/:id?', (req, res) => newLobby(req.params.id).then(result => res.status(result.status).json(result.result)))
    .get('/peek/:thing/:id', (req, res) => { // Allow to get the current state of a thing
        if (req.params.thing == 'board')
            re.table('boards').get(req.params.id).run(connection, (err, result) => {
                if (err)
                    res.status(400).json({ error: err.message })
                res.json(result)
            })
        else if (req.params.thing == 'lobby')
            re.table('lobbies').get(req.params.id).run(connection, (err, result) => {
                if (err)
                    res.status(400).json({ error: err.message })
                res.json(result)
            })
        else
            res.status(400).json({ error: "Invalid thing to join : must be 'board' or 'lobby'" })
    })
    .post('/update/lobby/:name/:new_sudoku', (req, res) => { // Allow to update the lobby
        updateLobby(req.params.name, req.params.new_sudoku).then(result => res.status(result.status).json(result.result))
    })
    .post('/update/:thing/:action/:id/:cell/:value', (req, res) => { // Allow to update some value (ws API is prefered)
        out = update(req.params.cell, req.params.value, req.params.action, req.params.id, req.params.thing).then((result) => {
            res.status(result.status).json(result.result)
        })
    })
    .use(express.static('static'))
    .use('/dist', express.static('node_modules/bootstrap/dist'))
    .use('/dist/umd', express.static('node_modules/react/umd'))
    .use('/dist/umd', express.static('node_modules/react-dom/umd'))


// Server

const server = api.listen(port, () => {
    console.log(`Listening on port ${port}`)
})

server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
})