const r = document.querySelector(":root");

let highlighted = false;
let highlightedVal = NaN;

// TODO: Highlight errors

const focusChange = async (e) => {
    const gotFocus = e.type == "focus";

    const cell = e.target.parentNode;
    const cellNB = parseInt(cell.id.substring(7));
    const row = Math.floor(cellNB / 9);
    const col = cellNB % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);

    let val = parseInt(e.target.innerHTML);

    if (highlighted && gotFocus && highlighted != cellNB) {
        await new Promise((resolve, reject) => {
            let trials = 0;
            let interval = setInterval(() => {
                if (!highlighted || !gotFocus) {
                    clearInterval(interval);
                    resolve();
                } else if (trials > 10) {
                    clearInterval(interval);
                    reject();
                }
                trials++;
            }, 5); // Wait for other highlights to clear or timeout after 10ms
        }).catch(() => {
            // Nuke all highlights
            for (let i = 0; i < 9; i++) {
                highlightRow(i, false);
                highlightCol(i, false);
                highlightBox(i, false);
            }
        });
    }

    // TODO: Make them optional
    highlightValue(val, gotFocus);
    highlightRow(row, gotFocus);
    highlightCol(col, gotFocus);
    highlightBox(box, gotFocus);

    highlighted = gotFocus ? cellNB : false;
}


const highlightValue = (val, highlight) => {
    if (!highlight) val = highlightedVal

    // TODO IMPROVE: Use board object instead of querySelectorAll

    let cells = document.querySelectorAll(`.Cell-content:not(:empty)`);
    cells.forEach((cell) => {
        if (parseInt(cell.innerHTML) == val) {
            if (highlight) cell.classList.add("highlightVal");
            else cell.classList.remove("highlightVal");
        }
    });
    highlightedVal = highlight ? val : NaN;
}

const highlightRow = (row, highlight) => {
    for (let col = 0; col < 9; col++) {
        let cell = document.getElementById(`CellNB-${row * 9 + col}`);
        if (highlight) cell.classList.add("highlight");
        else cell.classList.remove("highlight");
    }
}

const highlightCol = (col, highlight) => {
    for (let row = 0; row < 9; row++) {
        let cell = document.getElementById(`CellNB-${row * 9 + col}`);
        if (highlight) cell.classList.add("highlight");
        else cell.classList.remove("highlight");
    }
}

const highlightBox = (box, highlight) => {
    for (let row = Math.floor(box / 3) * 3; row < Math.floor(box / 3) * 3 + 3; row++) {
        for (let col = (box % 3) * 3; col < (box % 3) * 3 + 3; col++) {
            let cell = document.getElementById(`CellNB-${row * 9 + col}`);
            if (highlight) cell.classList.add("highlight");
            else cell.classList.remove("highlight");
        }
    }
}

const checkInput = (e) => {
    document.getElementById("join-btn").disabled = document.getElementById("lobby-name").value == '' || socket.readyState != 1;
    return true;    // Allow input
}
