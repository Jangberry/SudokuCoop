let url = (new URL(window.location));
url.protocol = "ws:";
let socket;
let socketTrals = 0;

let board;
let lobby;

const connect = () => {
    socket = new WebSocket(url);

    socket.onmessage = function (event) {
        console.log(event.data);
        let message = JSON.parse(event.data);

        if (message.error) {
            toast(message.error);
        } else if (message.lobby) {
            let joining = lobby ? message.lobby.name != lobby.name : true;
            updateLobby(message.lobby);
            if (joining) {
                toast("You just joined " + message.lobby.name);
                document.getElementById("lobby-name").value = message.lobby.name;
                document.getElementById("sudoku-btn").disabled = false;
                localStorage.lobbyName = message.lobby.name;
            }
        } else if (message.board) {
            updateBoard(message.board);
        }
    }

    socket.onopen = function (event) {
        if (localStorage.lobbyName) document.getElementById("lobby-name").value = localStorage.lobbyName;
        if (document.getElementById('lobby-name').value) join()
        document.getElementById("join-btn").disabled = document.getElementById("lobby-name").value == '';
        document.getElementById("create-btn").disabled = false;
        socketTrals = 0;
    }

    socket.onclose = function (event) {
        document.getElementById("sudoku-btn").disabled = true;
        document.getElementById("join-btn").disabled = true;
        document.getElementById("create-btn").disabled = true;
        document.getElementById("board").disabled = true;

        lobby = undefined;
        board = undefined;

        toast("Connection lost\nTrying to reconnect...");
        setTimeout(connect(), min(30000, 1000 + socketTrals*socketTrals * 1000));
        socketTrals++;
    }
}
connect();

const toast = (message) => {
    var toastElList = [].slice.call(document.querySelectorAll('.toast'))
    var toastList = toastElList.map(function (toastEl) {
        toastEl.querySelector('.toast-body').innerHTML = message;
        return new bootstrap.Toast(toastEl)
    })
    toastList.forEach(toast => toast.show())
}
document.querySelector('.toast').addEventListener('hidden.bs.toast', () => { onresize(); })

const updateLobby = (new_lobby) => {
    lobby = new_lobby;
    document.getElementById("lobby-name").value = lobby.name;
    if (lobby.board_id) {
        socket.send(JSON.stringify({ type: 'join', join: 'board', board: lobby.board_id }));
    }
}

const updateBoard = (new_board) => {
    if(!board || board.id != new_board.id){
        toast(board ? "New board created" : "Board loaded");
        document.getElementById('difficulty').value = new_board.difficulty;
    }
    board = new_board;
    board.board.forEach((cell_data, i) => {
        cellEl = document.getElementById(`CellNB-${i}`);
        cellEl.children[1].childNodes.forEach((small) => small.style.visibility = "hidden")
        if (cell_data == 0) {
            cellEl.children[0].setAttribute("contenteditable", true);
            if (board.guesses && board.guesses[String(i)] != undefined) {
                cellEl.children[0].innerHTML = board.guesses[String(i)];
            } else if (board.small && board.small[String(i)] != undefined) {
                board.small[String(i)].forEach((hint) => {
                    cellEl.children[1].children[hint - 1].style.visibility = "visible";
                })
            } else cellEl.children[0].innerHTML = "";
        } else {
            cellEl.children[0].setAttribute("contenteditable", false);
            cellEl.children[0].innerHTML = cell_data;
        }
    });
}

let modifierDown = {}

const isModifierDown = () => {
    for (let key in modifierDown) { return true; }
    return false;
}
document.onkeydown = (e) => {
    let move;
    if (e.key == "Control") modifierDown.ctrl = true;
    else if (e.key == "Alt") modifierDown.alt = true;
    else if (e.key == "AltGraph") modifierDown.altGraph = true;
    else if (e.key == "ArrowDown") move = 9;
    else if (e.key == "ArrowUp") move = -9;
    else if (e.key == "ArrowLeft") move = -1;
    else if (e.key == "ArrowRight") move = 1;
    else if (e.key == "Backspace" || e.key == "Delete") { e.target.innerHTML = ""; inputInCell(e); }
    else if (isModifierDown() && !isNaN(parseInt(e.key)) && parseInt(e.key) > 0 && parseInt(e.key) < 10) { smallEvent(e); delete modifierDown.mobile; }
    //else if (!isNaN(parseInt(e.key)) && parseInt(e.key) > 0 && parseInt(e.key) < 10) {e.target.innerHTML = e.key; inputInCell(e);}

    if (move) {
        let activeCell = document.activeElement;
        let nextCell = document.getElementById(`CellNB-${parseInt(activeCell.parentNode.id.substring(7)) + move}`);
        if (nextCell) nextCell.children[0].focus();
    }
}
document.onkeyup = (e) => {
    if (e.key == "Control") delete modifierDown.ctrl;
    else if (e.key == "Alt") delete modifierDown.alt;
    else if (e.key == "AltGraph") delete modifierDown.altGraph;
}

inputInCell = (e) => {
    let clear = e.target.innerHTML == "";
    if (!clear && e.nativeEvent.data == "^") {
        modifierDown.mobile = true;
        e.target.innerHTML = "";
        return;
    } else if (modifierDown.mobile) {
        delete modifierDown.mobile;
        e.target.innerHTML = "";
        return;
    } else if (!board) {
        e.target.innerHTML = "";
        return;
    }

    let val = clear ? NaN : parseInt(e.nativeEvent.data);

    highlightValue(NaN, false)
    highlightValue(val, true)
    
    // TODO: clear small hints when clearing a lready clear container

    if (!clear && (val > 9 || val < 1 || isNaN(val))) {
        e.target.innerHTML = "";
    } else {
        e.target.innerHTML = clear ? "" : val;
        socket.send(JSON.stringify({ type: 'update', update: 'cell', action: clear ? 'del' : 'put', board: board.id, cell: e.target.parentNode.id.substring(7), value: val }));
    }
}


const join = () => {
    let lobby_name = document.getElementById("lobby-name").value;
    socket.send(JSON.stringify({ type: 'join', join: 'lobby', lobby: lobby_name }));
}

const create = () => {
    rq = new XMLHttpRequest();
    rq.open("GET", "/new/lobby/");

    rq.onload = function () {
        document.getElementById("lobby-name").value = JSON.parse(rq.responseText).name;
        join();
        newSudoku();
    }

    rq.send();
}

const newSudoku = () => {
    rq = new XMLHttpRequest();
    const difficulty = document.getElementById("difficulty").value;
    const symmetry = document.getElementById("symmetry").value;
    rq.open("GET", `/new/sudoku/${difficulty}/${symmetry}`);

    rq.onload = function () {
        board = JSON.parse(rq.responseText);
        socket.send(JSON.stringify({ type: 'update', update: 'lobby', lobby: lobby.name, board: board.id }));
    }

    rq.send();
}

function smallEvent(e) {
    e.preventDefault();
    if (e.target.parentNode.children[0].innerHTML != "") {
        return;
    }
    let val = parseInt(e.key);
    let subcell = e.target.parentNode.children[1].children[val - 1]

    const del = subcell.style.visibility == "visible";

    subcell.style.visibility = del ? "hidden" : "visible";
    socket.send(JSON.stringify({ type: 'update', update: 'small', action: del ? 'del' : "put", board: board.id, cell: e.target.parentNode.id.substring(7), value: val }));
}
