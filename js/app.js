/** TODO: store game state so it can be picked up later */
/** TOTO: for Safari find a way to use local storage without setting the Develop menu item */
/** TODO: keep time records for each player */
/** TODO: work on better outcome for double clicking cards */  // DONE RES 5/15/18
/** TODO: work on touch device logic, i.e., streamline it */

// these three constants are the maximum values for one, two and three star ratings
// RES 5/9/18 U reviewer noted that there should always be at least one filled in star
//            So I'm removeing the one star limit
/*  const oneStarLimit = 48;  */
const twoStarLimit = 38;
const threeStarLimit = 30;

/*
 * Create a list that holds all of your cards
 */

// starting deck front face values initialized before shuffle
// these are shuffled when the game begins and stored in the "deck" variable
const initialDeck = [
    "diamond",
    "paper-plane-o",
    "anchor",
    "bolt",
    "cube",
    "anchor",
    "leaf",
    "bicycle",
    "diamond",
    "bomb",
    "leaf",
    "bomb",
    "bolt",
    "bicycle",
    "paper-plane-o",
    "cube"
];

// deck element
const deckEl = document.querySelector(".deck");

// each card consists of two <i> elements - a front element and a back element,
// which together represent both sides of a card
// the backside of both front and back elements are kept from showing through when
// the card is flipped by using CSS backface-visibiliy: hidden
const cardEl = document.querySelectorAll(".card .fa.front");
const cardBackEl = document.querySelectorAll(".card .fa.back");

// element used to start a new game
const restartEl = document.querySelector(".restart");

// used to enter the players code
const codeNameEl = document.querySelector(".score-panel input");
let codeName = "";

// an array of cards that currently are face up
// cards are pushed and popped onto and off as a LIFO stack as the game is played
const openCards = [];

// count of matches at any given point in time
// this is an object since the increment function is expecting an object
const matches = {count: 0};

// number of times the player has flipped any of the cards face up
// title is used as the label when displaying the count
const plays = {count: 0, title: "Plays"};

// keep track of player's highest score
// this is maintained in local storage
let bestScore = 0;
let playerBestScores = {};

// plays element
const playsEl = document.querySelector(".plays");

// best score element
const bestScoreEl = document.querySelector(".best");

// timer variables
// times used to caluclate the interval spent in playing the game
let startTime = null;
let stopTime = null;
let intervalTimer;
// when the player turns up the second card in attempting to find a match,
// this timer is started and times out in 3.5 seconds at which time thr cards are
// turned face down
// if the player attempts to turn another card face up before theis timer expires,
// both cards are turned face down and the new card is turned face up
let twoCardsVisibleTimer = null;

/**
 * @constructor
 * @function EventSemaphore
 * @desc signals that a type of event is in process
 *       used to allow the code to "know" that another event is in process
 * @param {Boolean} val - true means the semaphore is on, i.e., an event is in progress
 *                      - false means that an event is not in pregress
 * @param {string} type - event type, e.g., 'click' (currently not used)
 * @returns nothing
 */
function EventSemaphore(val, type) {
    this.val = val;
    this.type = type;
    this.toggle = function() {this.val = (val ? false : true);};
    this.set = function() {this.val = true;};
    this.reset = function() {this.val = false;};
    this.get = function() {return this.val;};
}

// used to determine if two cards are face up and not matching
// when this situation occurs, a timer is started
const clickSem = new EventSemaphore(false, "click");
// prevents playing the game unless a code name has been entered
const nameSem = new EventSemaphore(false, "click");

/*
 * Display the cards on the page
 *   - shuffle the list of cards using the provided "shuffle" method below
 *   - loop through each card and create its HTML
 *   - add each card's HTML to the page
 */


/**
 * @function shuffle
 * @desc Randomize the elements of an array in place
 * @param {array} array - items to be randomized/shuffled
 * @returns - array with items randomized
 */
// from Knuth, D.E., Seminumerical Algorithms, Vol. 2, 3rd Ed., pp. 145, Algorithm P
// using Knuth's variable labels
function shuffle(array) {
    let j = array.length-1, temp, k;

    tryAgain:
    while (j > 0) {
        // get a random integer between 0 and j
        k = Math.floor(Math.random() * j);
        // no sense in using j when equal to k, i.e., why move j to itself?
        if (j === k) {continue tryAgain;}
        // exchange array elements at indices j and k
        temp = array[j];
        array[j] = array[k];
        array[k] = temp;
        // item at index j is now in place, go and do the same for j-1
        j--;
    }
    return array;
}


/**
 * @function modalButtonHandler
 * @desc process modal popup game summary buttons - same player, new player, done
 * @param {event} e - event which caused this function to be invoked
 * @returns nothing
 */
function modalButtonHandler(e) {
    let button = e.target;
    let buttons;
    /* if click is not on a button, ignore it  */
    if (button !== document.querySelector("button.same-player") &&
        button !== document.querySelector("button.new-player") &&
        button !== document.querySelector("button.game-over")) {return;}
    switch (button.className) {
        case "same-player":
            // if user clicks cancel button, the game ends and allows player to click
            // on his/her name to play again
            codeNameEl.removeAttribute("disabled");
            codeNameEl.setAttribute("autofocus", true);
            buttons = document.querySelectorAll(".modal-body button");
            for (let i=0; i<3; i++) {
                buttons[i].disabled = true;
            }
            document.querySelector(".modal-container").style.visibility = "hidden";
            if (!(document.querySelector("body.user-is-touching" === null))) {
                restartEl.dispatchEvent(new MouseEvent("dblClick"));
            }
            break;
        case "new-player":
            // if user clicks ok button, the game restarts and requires player
            // name to be entered
            document.querySelector(".restart").click();
            break;
        case "game-over":
            codeNameEl.removeAttribute("disabled");
            buttons = document.querySelectorAll(".modal-body button");
            for (let i=0; i<3; i++) {
                buttons[i].disabled = true;
            }
            document.querySelector(".modal-container").style.visibility = "hidden";
            break;
        default:
            throw ("Invalid value in modalButtonHandler");
    }
}

/**
 * @function popup
 * @desc Displays the modal popup at the end of the game
 *       This is a responsive popup as opposed to the js confirm function
 * @param {String} msg - message to display
 * @returns nothing
 */
/* from quora.com "How do I create a customized responsive confirm box without
  using any libraries (i.e Bootstrap, jQuery)? Oct 2, 2017 Saptarshi Basu"  */
function popUp(msg) {
    /* start a click handler for the buttons */
    let modalEl = document.querySelector(".modal-body");
    modalEl.addEventListener("click", modalButtonHandler);
    let buttons = modalEl.querySelectorAll("button");
    for (let i=0; i<3; i++) {
        buttons[i].disabled = false;
    }
    /* setup the message to be displayed  */
    modalEl = document.querySelector(".modal-body p");
    modalEl.innerHTML = msg;
    /* make the modal popup visible */
    modalEl = document.querySelector(".modal-container");
    modalEl.style.visibility = "visible";
}


/**
 * @function increment
 * @desc Increments counter and, optionally, inserts HTML text with a label (title)
 * @param {object} countObj - object with attributes count and title
 *                          - count is incremented and combined with title to be displayed
 * @param {DOM element} element - DOM element in whcih the count is to be displayed
 * @returns nothing
 */
function increment(countObj, element) {
    countObj.count++;
    if (element !== undefined) {
        element.innerHTML = countObj.count + " " + countObj.title;
    }
}


/**
 * @function flip
 * @desc effectively turns a card opposite to its present state - either faceup or facedown
 *       the flipping action is performed by CSS transform styling using HTML element
 *       classes "open" and "show"
 * @param {DOM element} card - indicates which card to turn over
 * @returns nothing
 */
function flip(card) {
    card.classList.toggle("open");
    card.classList.toggle("show");
}


/**
 * @function timer
 * @desc used to determine the time it takes to play one round of the game
 *       much of the concept for this is from w3schools.com "How To Create a Countdown Timer"
 *       though this is not a count down timer
 * @param {string} startStop - must be one of "start", "stop", "interval"
 * @returns {object or nothing} - lapsed time {mins, secs} since game start for "interval", nothing for "start" or "stop"
 */
function timer(startStop) {
    let calcInt;
    let calcMins;
    let calcSecs;
    switch (startStop) {
        // updates the lapsed time on the web page every second
        // starts when the game starts
        case "start":
            startTime = new Date().getTime();
            intervalTimer = setInterval(function() {
                const now = new Date().getTime();
                calcInt = now - startTime;
                calcMins = Math.floor((calcInt % 3600000) / 60000);
                calcSecs = Math.floor((calcInt % 60000) / 1000);
                // from Sitepoint Pty Ltd, "Build a Countdown Timer in Just 18 Lines of Javascript"
                document.querySelector(".lapsed-time .min").innerHTML = (" " + calcMins).slice(-2);
                document.querySelector(".lapsed-time .sec").innerHTML = " " + (" " + calcSecs).slice(-2);
                }, 1000);
            break;
        // stops when the last matching pair is discovered
        case "stop":
            stopTime = new Date().getTime();
            clearInterval(intervalTimer);
            break;
        // calculates the interval between start and stop times and converts to
        // minutes and seconds
        case "interval":
            calcInt = stopTime - startTime;
            calcMins = Math.floor((calcInt % 3600000) / 60000);
            calcSecs = Math.floor((calcInt % 60000) / 1000);
            return {mins: calcMins, secs: calcSecs};
        default:
            throw "invalid value " + startStop + " passed to function timer";
    }
}


/**
 * @function updateStars
 * @desc deteremines how many filled in stars are displayed based on preset limits as
 *       defined above in oneStarLimit, twoStarLimit, threeStarLimit
 *       these are diplayed based on font-awesome classes and CSS
 * @param none
 * @returns nothing
 */
function updateStars() {
    const stars = document.querySelectorAll(".stars li i");
    for (let i=0; i < 3; i+=1) {
        switch (i) {
            // changed so that one solid star always shows
            case 0:
                stars[i].classList = "fa fa-star";
                break;
            case 1:
                stars[i].classList = "fa " + (plays.count <= twoStarLimit ? "fa-star" : "fa-star-o");
                break;
            case 2:
                stars[i].classList = "fa " + (plays.count <= threeStarLimit ? "fa-star" : "fa-star-o");
               break;
        }
    }
}


/**
 * @function finalStars
 * @desc final verson of the stars for display in the congratulatory text message
 *       because these stars are displayed as part of a text message, unicode
 *       values for the stars are used
 * @param none
 * @returns {string} - always returns 3 stars each of which is either filled in or not
 *                     depending on the number of plays used by the player
 */
function finalStars() {
    let s = "";
    // changed so that one solid star always shows
    s += "\u2605 ";
    s += (plays.count <= twoStarLimit ? "\u2605" : "\u2606") + " ";
    s += (plays.count <= threeStarLimit ? "\u2605" : "\u2606") + " ";
    return s;
}


/**
 * @function wrapup
 * @desc when all pairs of cards have been matches, displays a message and initiates
 *       a restart if desired
 *       if not, allows restart for the same player by clicking his/her name
 * @param none
 * @returns nothing
 */
function wrapUp() {
    if (matches.count >= (cardEl.length/2)) {
        timer("stop");
        bestScore = (bestScore == 0 ? plays.count : (plays.count < bestScore ? plays.count : bestScore));
        bestScoreEl.innerHTML = "Best " + bestScore;
        playerBestScores[codeName.toString()] = bestScore;
        // save best score to local storage using JSON so a string can be sent
        localStorage.setItem("playerBestScores", JSON.stringify(playerBestScores));
        let timeOfPlay = timer("interval");
        if (!(document.querySelector("body.user-is-touching") === null)) {
            popUp("Congratulations! You won!\n" +
                    "Time " + timeOfPlay.mins + "m " + timeOfPlay.secs + "s\n" +
                    finalStars() + "\n\n" +
                    "To play again press New Game button\nOtherwise press Done");
        } else {
            popUp("Congratulations! You won!\n" +
                    "Time " + timeOfPlay.mins + "m " + timeOfPlay.secs + "s\n" +
                    finalStars() + "\n\n" +
                    "To play again press a player button\nOtherwise press Done");
        }
    }
}


/**
 * @function getFaClassCard
 * @desc retrieves the class name of the element which has class containing "fa-",
 *       else null
 *       this is used to determine if the two cards turned face up are matches, i.e.,
 *       if their "fa-" classes match
 *       "fa-" classes indicate the face value of the card by telling its icon
 * @param {DOM element} card - the card whose class name is desired
 * @returns {string or null} - class name indicating face value of input card
 */
function getFaClass(card) {
    let done = false;
    let i = 0;
    let res = "";
    let className = "";
    const firstChild = card.children[0];
    while (!done) {
        className = firstChild.classList.item(i);
        // regexp to find class name from class list
        res = /fa-/.exec(className);
        if (res !== null) {return className;}
        i++;
        if (i >= firstChild.classList.length) {return null;}
    }
}


/**
 * @function namePresent
 * @desc sets up the class names and attributes required for game to be played
 *       until the name is entered the game cannot be played
 * @param none
 * @returns nothing
 */
function namePresent() {
    if (codeNameEl.classList.contains("nameOk")) {return;}
    // removes class start
    codeNameEl.classList.toggle("start");
    // adds class nameOk
    codeNameEl.classList.toggle("nameOk");
    // sets the name semaphore to on, thus preventing any further name finagling
    nameSem.set();
    codeNameEl.setAttribute("readonly", "");
    codeNameEl.setAttribute("disabled", "");
    // starts the game timer
    timer("start");
}


/**
 * @function restartHandler
 * @desc used to restart the game by using the restart button or by clicking in
 *       the name field
 *       the latter method allows the same player to play again w/o re-entering name
 * @param {event} e - the event triggering this handler
 *                  - ignored unless it's a "click" or "dblClick"
 *                  - dblClick is issued by codeNameHandler to save session storage in
 *                  - preparation for restoring it after the restart
 * @returns nothing
 */
function restartHandler(e) {
    // this occurs when the restart button is used
    // a new user can play in this case, i.e., the name must be entered again
    if (e.type === "click") {
        // remove session info if it's there
        sessionStorage.removeItem("codeName");
        if (!(document.querySelector("body.user-is-touching") === null)) {
            sessionStorage.setItem("user-is-touching", "user-is-touching");
        }
        location.reload(true);
    } else
    // this occurs when the name text area is clicked
    // this case is provided so that the same user can play again with no re-entry of name
    // so it prevents the user from incorrectly entering his name
    if (e.type === "dblClick") {
        // save this players session info in case he wants to play again
        if (document.querySelector("body.user-is-touching") === null) {
            sessionStorage.setItem("codeName", codeName);
        } else {
            sessionStorage.setItem("user-is-touching", "user-is-touching");
        }
        location.reload();
    }
}


/**
 * @function codeNameHandler
 * @desc this is entered when a click event or enter key event occurs with
 *       the name field selected
 *       enter key is used when the name is typed in at the beginning of a game
 *       click is used after one or more games have been played and the player
 *       wishes to play again
 * @param {event} e - event which triggered the function execution
 * @returns nothing
 */
function codeNameHandler(e) {
    // click was pressed from name field
    // used when the same player wants to play again w/o re-entering name
    if (e.type === "click") {
        if (!codeNameEl.classList.contains("start")) {
            // a click event later means restart and use session storage to retain name
            restartEl.dispatchEvent(new MouseEvent("dblClick"));
        } else {
            // a click event at the start is not used/allowed
            return;
        }
    } else
    // enter key was pressed from name field when in start state
    if (e.keyCode === 13) {
        codeName = e.target.value;
        // check size of name and recheck characters
        if (!(/^[0-9a-zA-Z@%^#]{2,8}$/.exec(codeName))) {
            alert("Invalid name:\nmust be 2-8 characters\nalphanumeric or @, %, ^, or #");
            codeNameEl.value = "";
            return;
        }
        if (codeName && playerBestScores) {
            if (playerBestScores.hasOwnProperty(codeName.toString())) {
                bestScore = parseInt(playerBestScores[codeName.toString()]);
            } else {
                bestScore = 0;
            }
            codeNameEl.value = codeName;
            bestScoreEl.innerHTML = "Best " + bestScore + "  ";
            namePresent();
        } else
        if (codeName) {  // in this case playerBestScores is null or empty
            bestScore = 0;
            codeNameEl.value = codeName;
            bestScoreEl.innerHTML = "Best " + bestScore + "  ";
            namePresent();
        } else {    // codeName not entered
            alert("You must enter a code name in order to play");
        }
    } else
    // name validation regex
    if (e.key.match(/[0-9a-zA-Z@%^#]/)) {
        return;
    } else {
        alert("Invalid character: must be alphanumeric or @, %, ^, or #");
    }
}


/**
 * @function deckClickHandler
 * @desc event handler connected to deck classed element which has "li" sub-elements
 *       representing cards which in turn have "i" sub-elements
 *       the "i" elements are used per the awesome-font class recommendations in
 *       their specs
 * @param {event} e - event object associated with the event which caused this handler to be called
 * @returns nothing
 */
function deckClickHandler(e) {
    // name must be entered before playing
    if (!nameSem.get()) {return;}

    let card = e.target;
    // don't care about a click on the deck itself (game board), want a click on a card
    if (card === document.querySelector("ul.deck")) {return;}

    // if click is on the image on back of card, make card the parent element (an li)
    // li's have  a class of card
    if (card.tagName === "I") {
        card = card.parentNode;
    }
    // don't flip card if it's already face up
    for (let i=0; i<openCards.length; i++) {
        if (card === openCards[i]) {return;}
    }
/*    if (openCards.length !== 0 && card === openCards[openCards.length-1]) {return;}  */

    // this flips two non-matching cards back to face down before next card turned up
    // clickSem is only set when there are two non-matching cards face up
    if (clickSem.get()) {
        clearTimeout(twoCardsVisibleTimer);
        clickSem.reset();
        twoCardsVisibleTimer = null;
        flip(openCards.pop());
        flip(openCards.pop());
    }


    let classes = card.classList;
    // card shouldn't already have been matched
    if (!classes.contains("match")) {
        increment(plays, playsEl);
        flip(card);
        classes = card.classList;
        if (classes.contains("open") && classes.contains("show")) {
            if (openCards.length === 0) {
                openCards.push(card);
            } else
            // cards match
            if (getFaClass(card) === getFaClass(openCards[openCards.length-1])) {
                let cardAlreadyUp = openCards.pop();
                classes.add("match");
                cardAlreadyUp.classList.add("match");
                classes.remove("show");
                cardAlreadyUp.classList.remove("show");
                increment(matches);
                wrapUp();
            } else {
                // cards don't match so set a timer to cause the cards to be returned
                // to facedown position if another card isn't selected first
                openCards.push(card);
                clickSem.set();
                twoCardsVisibleTimer = setTimeout(function() {
                    flip(openCards.pop());
                    flip(openCards.pop());
                    clickSem.reset();
                }, 3500);
            }
        }
    }
    updateStars();
}


/* want to know if it's a touchscreen device */
/* if game has already been played in this session shortcut the display process */
let touchDev = sessionStorage.getItem("user-is-touching");
if (touchDev) {
    document.body.classList.add('user-is-touching');
    codeName = "~Touch~";
    codeNameEl.style.display = "none";
    document.querySelector("button.new-player").style.display = "none";
    document.querySelector("button.same-player").innerHTML = "New Game";
} else {
    /* from codeburst.io, "The only way to detect touch with Javascript", David Gilbertson, Aug 13, 2016 */
    window.addEventListener('touchstart', function onFirstTouch() {
        document.body.classList.add('user-is-touching');
        codeName = "~Touch~";
        codeNameEl.style.display = "none";
        document.querySelector("button.new-player").style.display = "none";
        document.querySelector("button.same-player").innerHTML = "New Game";
        if (playerBestScores) {
            if (playerBestScores.hasOwnProperty(codeName.toString())) {
                bestScore = parseInt(playerBestScores[codeName.toString()]);
            } else {
                bestScore = 0;
            }
            codeNameEl.value = codeName;
            bestScoreEl.innerHTML = "Best " + bestScore + "  ";
            namePresent();
        } else {     // in this case playerBestScores is null or empty
            bestScore = 0;
            codeNameEl.value = codeName;
            bestScoreEl.innerHTML = "Best " + bestScore + "  ";
            namePresent();
        }
        // we only need to know once that a human touched the screen, so we can stop listening now
        window.removeEventListener('touchstart', onFirstTouch, false);
    }, false);
}

restartEl.addEventListener("click", restartHandler);
restartEl.addEventListener("dblClick", restartHandler);

// retrieve players' top scores if present
playerBestScores = JSON.parse(localStorage.getItem("playerBestScores"));
if (!playerBestScores) {playerBestScores = {};}

// if session storage is present, use it to get player's info
if (!codeName) {codeName = sessionStorage.getItem("codeName");}
if (!codeName) {
    codeName = "";
} else {
    codeNameEl.value = codeName;
    bestScore = playerBestScores[codeName.toString()];
    if (!bestScore) {bestScore = 0;}
    bestScoreEl.innerHTML = "Best " + bestScore + "  ";
    namePresent();
}

let deck = shuffle(initialDeck);

for (let i=0; i < cardEl.length; i+=1) {
    cardEl[i].className = "fa fa-" + deck[i] + " front";
    cardBackEl[i].className = "fa fa-google back show";
}

codeNameEl.addEventListener("keyup", codeNameHandler);
codeNameEl.addEventListener("click", codeNameHandler);
deckEl.addEventListener("click", deckClickHandler);

/*
 * set up the event listener for a card. If a card is clicked:
 *  - display the card's symbol (put this functionality in another function that you call from this one)
 *  - add the card to a *list* of "open" cards (put this functionality in another function that you call from this one)
 *  - if the list already has another card, check to see if the two cards match
 *    + if the cards do match, lock the cards in the open position (put this functionality in another function that you call from this one)
 *    + if the cards do not match, remove the cards from the list and hide the card's symbol (put this functionality in another function that you call from this one)
 *    + increment the move counter and display it on the page (put this functionality in another function that you call from this one)
 *    + if all cards have matched, display a message with the final score (put this functionality in another function that you call from this one)
 */
