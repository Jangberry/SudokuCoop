const BoardContainer = <div id="board-container" className="square rounded"> <Board></Board> </div>;

function Board(props) {
    let board = [];
    for (let i = 0; i < 81; i++) {
        board.push(<Cell key={i} nb={i}></Cell>);
    }
    return board;
}

function Cell(props) {
    return <div className="Cell" id={"CellNB-"+String(props.nb)} data-NB={props.nb}><CellContent nb={props.nb}></CellContent><SubCellsContainer></SubCellsContainer></div>;
}

function CellContent(props) {
    return <div className="Cell-content" tabIndex={props.nb+1} onInput={inputInCell} onFocus={focusChange} onBlur={focusChange}></div>
}

function SubCellsContainer(props) {
    return <div className="SubCellsContainer"><SubCells></SubCells></div>;
}

function SubCells(props) {
    let subCells = [];
    for (let i = 0; i < 9; i++) {
        subCells.push(<SubCell key={i} nb={i}></SubCell>);
    }
    return subCells;
}

function SubCell(props) {
    return <div className="SubCell">{props.nb+1}</div>;
}

ReactDOM.render(BoardContainer, document.getElementById('board'));

let root = document.querySelector(':root');
const onresize = () => {
    let height = document.getElementById('board-container').clientHeight;
    root.style.setProperty('--cell-size', height/9 + 'px');
}
document.getElementById('board-container').addEventListener('resize', onresize);
onresize();

