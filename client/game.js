const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Add a basic light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 0, 50).normalize();
scene.add(light);

// Position the camera
camera.position.set(0, 0, 45);
camera.lookAt(0, 0, 0);

// Load the video
const background = document.createElement('video');
background.src = '../effects/backgroundMatrix.mp4';
background.loop = true;
background.muted = true;
background.play();
const videoTexture = new THREE.VideoTexture(background);
videoTexture.minFilter = THREE.LinearFilter;
videoTexture.magFilter = THREE.LinearFilter;
videoTexture.format = THREE.RGBFormat;
const backGeometry = new THREE.PlaneGeometry(500, 250);
const backMaterial = new THREE.MeshBasicMaterial({ map: videoTexture });
const backVideoPlane = new THREE.Mesh(backGeometry, backMaterial);
backVideoPlane.position.set(0, 0, -100);
scene.add(backVideoPlane);

//game over video
const gameOverVideo = document.createElement('video');
gameOverVideo.src = '../effects/gameOver.mp4';
gameOverVideo.loop = true;
gameOverVideo.muted = true;

const gameOverTexture = new THREE.VideoTexture(gameOverVideo);
gameOverTexture.minFilter = THREE.LinearFilter;
gameOverTexture.magFilter = THREE.LinearFilter;
gameOverTexture.format = THREE.RGBFormat;
const gameOverGeometry = new THREE.PlaneGeometry(150, 80);
const gameOverMaterial = new THREE.MeshBasicMaterial({ map: gameOverTexture });
const gameOverPlane = new THREE.Mesh(gameOverGeometry, gameOverMaterial);
gameOverPlane.position.set(0, 0, 2);
gameOverPlane.visible = false; // Initially hidden
scene.add(gameOverPlane);

//explosion        
const explosionVideo = document.createElement('video');
explosionVideo.src = '../effects/explosion.mp4';
explosionVideo.loop = false;
explosionVideo.muted = true;
const explosionTexture = new THREE.VideoTexture(explosionVideo);
explosionTexture.minFilter = THREE.LinearFilter;
explosionTexture.magFilter = THREE.LinearFilter;
explosionTexture.format = THREE.RGBFormat;
const explosionGeometry = new THREE.PlaneGeometry(6, 6);
const explosionMaterial = new THREE.MeshBasicMaterial({ map: explosionTexture, transparent: true });
const explosionPlane = new THREE.Mesh(explosionGeometry, explosionMaterial);
explosionPlane.visible = false;
scene.add(explosionPlane);

// sound effects
const explosionSound = new Audio('../effects/explosionSound.mp3');
const winSound = new Audio('../effects/win.wav');
const loseSound = new Audio('../effects/lose.wav');
// Load the board model
const loader = new THREE.GLTFLoader();
let board = null;
loader.load('../models/chess_board/scene.gltf', function (gltf) {
    board = gltf.scene;
    board.rotation.x = Math.PI / 2;
    board.rotation.y = Math.PI / 2;
    scene.add(board);
}, undefined, function (error) {
    console.error(error);
});

// Load the pieces models and set their positions
const pieces = [];
const positions = [];
const shiftX = 6;
const shiftY = 6;
for (let j = -21, row = 0; j <= 21; j += shiftY, row += 1) {
    for (let i = -21 + (row % 2 == 1) * 6; i <= 21; i += 2 * shiftX) {
        positions.push({ x: i, y: j });
    }
}
loader.load('../models/piece/scene.gltf', function (gltf) {
    positions.forEach((pos, index) => {
        if (Math.abs(pos.y) == 3)
            return;
        const piece = gltf.scene.clone();
        piece.traverse((node) => {

            if (node.isMesh) {
                const newMaterial = node.material.clone();
                newMaterial.color.set(index < positions.length / 2 ? 0xffffff : 0xff0000);
                node.material = newMaterial;
                piece.userData.team = index < positions.length / 2 ? 'white' : 'red';
                piece.userData.king = false;
            }
        });

        piece.scale.set(0.16, 0.16, 0.16);
        piece.position.set(pos.x, pos.y, 1.2);

        pieces.push(piece);
        scene.add(piece);
    });
}, undefined, function (error) {
    console.error(error);
});

// Set up raycaster and mouse for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let isGameOver = false;
let selectedIndex = null;
let currentTeam = 'white';
let highlightSquares = [];

function onMouseClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (selectedIndex !== null) { // change position of the piece
        // Calculate the position where the mouse clicked on the board
        const intersects = raycaster.intersectObject(board, true);
        if (intersects.length > 0) {
            const clickPosition = intersects[0].point;

            // Find the closest position in the positions array
            const closestPosition = getClosestPosition(clickPosition);

            // Move the piece to the closest position
            let result = movePiece(selectedIndex, closestPosition);
            selectedIndex = null;
            deleteHighlightSquare();
        }
    } else { // select the piece
        // Calculate the position where the mouse clicked on the board
        const intersects = raycaster.intersectObject(board, true);
        if (intersects.length > 0) {
            const clickPosition = intersects[0].point;

            // Find the closest position in the positions array
            const closestPosition = getClosestPosition(clickPosition);

            // Check if there is a piece at the closest position
            const pieceIndex = pieceAtPosition(closestPosition.x, closestPosition.y);
            if (pieceIndex !== null && pieces[pieceIndex].userData.team === currentTeam) {
                selectedIndex = pieceIndex;
                getPossibleMoves(pieceIndex);
            }
        }
    }
}
window.addEventListener('click', onMouseClick);

function createHighlightSquare(position, colorP) {
    const geometry = new THREE.PlaneGeometry(6, 6);
    const material = new THREE.MeshBasicMaterial({ color: colorP, transparent: true, opacity: 0.5 });
    const square = new THREE.Mesh(geometry, material);
    square.position.set(position.x, position.y, 1.3); // Slightly above the board
    scene.add(square);
    return square;
}

function deleteHighlightSquare() {
    highlightSquares.forEach(square => {
        scene.remove(square);
        square.geometry.dispose();
        square.material.dispose();
    });
}

function getClosestPosition(point) {
    let closestPosition = positions[0];
    let minDistance = point.distanceTo(new THREE.Vector3(closestPosition.x, closestPosition.y, 1.2));

    positions.forEach(pos => {
        let distance = point.distanceTo(new THREE.Vector3(pos.x, pos.y, 1.2));
        if (distance < minDistance) {
            closestPosition = pos;
            minDistance = distance;
        }
    });

    return closestPosition;
}

function pieceAtPosition(x, y) {
    for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i];
        if (piece !== null && piece.position.x === x && piece.position.y === y) {
            return i; // Return the index of the piece
        }
    }
    return null; // Return null if no piece is found
}

function movePiece(index, newPosition) {
    const currentPos = pieces[index].position;
    const distance = Math.abs(currentPos.x - newPosition.x);

    if (pieceAtPosition(newPosition.x, newPosition.y)) {
        // cannot move into the piece or the same square selected 
        return false;
    }

    if (Math.abs(newPosition.x - currentPos.x) !== Math.abs(newPosition.y - currentPos.y)) {
        // non-diagonal move             
        return false;
    }
    // Regular piece movement
    if (!pieces[index].userData.king) {
        if (pieces[index].userData.team === 'white' && newPosition.y <= currentPos.y) {
            // White pieces can only move up                  
            return false;
        }
        if (pieces[index].userData.team === 'red' && newPosition.y >= currentPos.y) {
            // Red pieces can only move down                   
            return false;
        }
    }
    let eatenIndex = canEat(currentPos, newPosition, pieces[index].userData.team);
    if (eatenIndex === null) {
        return false;
    }
    if ((distance > 12 && !pieces[index].userData.king) || (distance == 12 && eatenIndex === -1)) {
        // too far 
        return false;
    }

    pieces[index].position.set(newPosition.x, newPosition.y, pieces[index].position.z);
    checkPromotion(index);
    if (eatenIndex !== -1) {
        explosionPlane.position.set(pieces[eatenIndex].position.x, pieces[eatenIndex].position.y, 1.5);
        explosionPlane.visible = true;
        explosionVideo.play();
        explosionSound.play();
        explosionVideo.onended = () => {
            explosionPlane.visible = false;
        };

        scene.remove(pieces[eatenIndex]);
        pieces.splice(eatenIndex, 1);
    }
    currentTeam = currentTeam === 'white' ? 'red' : 'white';
    checkGameOver();
    return true;
}

function canEat(currentPos, newPosition, team) {
    let dx = shiftX;
    let dy = shiftY;
    if (newPosition.x < currentPos.x)
        dx *= -1;
    if (newPosition.y < currentPos.y)
        dy *= -1;
    let i = currentPos.x + dx;
    let j = currentPos.y + dy;
    let eatenIndex = -1;
    while (i != newPosition.x || j != newPosition.y) {
        let ind = pieceAtPosition(i, j);
        i += dx;
        j += dy;
        if (ind === null)
            continue;
        if (team === pieces[ind].userData.team)
            return null;
        if (eatenIndex !== -1)
            return null;
        eatenIndex = ind;
    }
    return eatenIndex;
}

function getPossibleMoves(index) {
    const piece = pieces[index];
    const currentPos = piece.position;

    let directions = [];
    if (piece.userData.king) {
        directions.push({ dx: shiftX, dy: shiftY },
            { dx: -shiftX, dy: shiftY },
            { dx: shiftX, dy: -shiftY },
            { dx: -shiftX, dy: -shiftY });
    } else {
        if (piece.userData.team == 'white') {
            directions.push({ dx: shiftX, dy: shiftY },
                { dx: -shiftX, dy: shiftY });
        } else {
            directions.push({ dx: shiftX, dy: -shiftY },
                { dx: -shiftX, dy: -shiftY });
        }
    }
    let colorP = 0xffff00;
    if (!piece.userData.king)
        colorP = 0x00ff00;

    directions.forEach(direction => {
        let i = currentPos.x + direction.dx;
        let j = currentPos.y + direction.dy;
        while (Math.abs(i) <= 21 && Math.abs(j) <= 21) {
            if (pieceAtPosition(i, j)) {
                i += direction.dx;
                j += direction.dy;
                continue;
            }
            let distance = Math.abs(i - currentPos.x);
            if (distance > 12 && !piece.userData.king) {
                // too far
                break;
            }
            let eatenIndex = canEat(currentPos, { x: i, y: j }, piece.userData.team);
            if (eatenIndex === null || (distance == 12 && !piece.userData.king && eatenIndex === -1)) {
                break;
            }
            highlightSquares.push(createHighlightSquare({ x: i, y: j }, colorP));
            i += direction.dx;
            j += direction.dy;
        }
    });

}

function checkPromotion(index) {
    const piece = pieces[index];
    if (piece.userData.king)
        return;
    const pos = piece.position;

    if ((piece.userData.team === 'white' && pos.y === positions[positions.length - 1].y) ||
        (piece.userData.team === 'red' && pos.y === positions[0].y)) {
        piece.rotation.y = Math.PI; // Flip the piece upside down
        piece.position.z = 1.9;
        piece.userData.king = true; // Promote to king
    }
}

function checkGameOver() {
    const whitePieces = pieces.filter(piece => piece.userData.team === 'white');
    const redPieces = pieces.filter(piece => piece.userData.team === 'red');

    if (whitePieces.length === 0 || redPieces.length === 0) {
        isGameOver = true;
        if (redPieces.length === 0)
            window.alert(`White has won the game!`);
        else 
            window.alert(`Red has won the game!`);
        gameOverVideo.loop = true;
        gameOverPlane.visible = true;
        gameOverVideo.play();
        winSound.play();
    }

}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

}


window.addEventListener('resize', onWindowResize, false);

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();  

// socket sending data logic

// const urlParams = new URLSearchParams(window.location.search);
// const port = urlParams.get('port') || 5500; // Default to 5500 if no port is specified
// const ws = new WebSocket(`ws://localhost:${port}`);

// ws.on('open', () => {
//     console.log(`Connected to server on port ${port}`);
// });

// ws.on('message', (message) => {
//     const data = JSON.parse(message);
//     console.log('Received:', data);
//     if (data.type === 'move') {
//         movePiece(data.index, data.newPosition);
//     }
// });

// function sendMove(move) {
//     console.log('Sending:', move);
//     ws.send(JSON.stringify(move));
// }

