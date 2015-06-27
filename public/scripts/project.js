//author: Brian Vernarsky

//this file contains all of the main workings for setting up and
//controlling the chat server

//start by connecting to the server, creating a variable socket, which will be used to
//deal with our handlers and emitters
var namespace = "/test";
var socket = io.connect('http://' + document.domain + ':' + location.port + namespace);

//use backbone models and collections to deal with the users, chat partners, and conversations
//the users are pretty easy, we'll let them basically manage themselves
var User = Backbone.Model.extend({});
var UserList = Backbone.Collection.extend({
    model: User,
    initialize: function(){
    }
});

//the partners are also very simple
var Partner = Backbone.Model.extend({});
var PartnerList = Backbone.Collection.extend({
    model: Partner,
    initialize: function(){
    }
});

//the conversations include a method for storing the contents of the
//conversations in the browser.  I used the backbone local storage for this
//while I used the regular localStorage for the username
var Conversation = Backbone.Model.extend({});
var ConversationList = Backbone.Collection.extend({
    model: Conversation,
    localStorage: new Backbone.LocalStorage("conversations"),
    initialize: function(){
    }
});


//Now we start to define the React classes to control the view.
//There are two main sections of the page, the top, which contains
//the login/username form and the list of currently available members,
//and then the lower sections, where all the chats will lie.

//The upper part consists of an AddNameBar, and the NameList, which is where we start


var NameList = React.createClass({
    //function for when a name is selected from the list
    //we first check to see that the user has logged in. You're not allowed to
    //chat without logging in.  This is not strictly necessary, since the user will
    //not get a full list of the available users until he has logged in, but
    //if another user logs in while he is waiting, it may be possible to see
    //some names populate the namelist
    selectName: function(event) {
        var _this = this;
        if (!_this.props.thisUserName == "") {
            //I have set the user's own name to be disabled on the namelist, so it
            //cannot be selected, but this check is still here, just in case
            if (event.target.value == _this.props.thisUserName) {
                console.log("Cannot converse with yourself");
            }
            else if (_this.props.myPartnerList.get(event.target.value)) {
                //If the user already has a chat box open with the person they selected,
                //we simply focus the cursor on that chat box
                console.log("You're already talking to " + event.target.value);
                $('#chatFormInput' + _this.props.myPartnerList.get(event.target.value).attributes.idnum).focus();
            }
            else {
                //If the user selects someone whom he is not currently speaking with,
                //we send a new chat request to the server, giving the users name, and
                //the person he is requesting to speak with.  Currently, all chat requests
                //are accepted, so we go to begin the chat.  It would be possible to add
                //in the ability to decline an invitation, in which case the user would need
                //to wait for an acceptance.
                console.log("Hey " + event.target.value);
                socket.emit('new chat', {fromName: _this.props.thisUserName, toName: event.target.value});
                //socket.on('chat accepted',_this.wait_for_acceptance);//to be defined...
                _this.props.beginChat(event.target.value,_this.props.thisUserName + event.target.value);
            }
        }
        else {
            //Here, the user is not logged in yet.
            alert("You must enter your name before beginning to chat");
            $('#nameFormText').focus();
        }
        //reset the select box to the default option
        $('#selectOptions').prop('selectedIndex', 0);
    },
    //our rendering function, which sets everything in motion
    render: function() {
        var nameNodes;
        var _this = this;
        //if no one has signed in, the user will see "No available members"
        //once he has logged in, there will be at least his name populating the list
        if (this.props.data.length == 0) {
            nameNodes = <option>No available members</option>
        }
        else {
            //names are added to the list.  The user's own name is disabled
            nameNodes = this.props.data.models.map(function (user) {
                if (user.attributes.name == _this.props.thisUserName) {
                    return (
                        <option disabled value={user.attributes.name}>
                            {user.attributes.name}
                        </option>
                    );
                }
                else {
                    return (
                        <option value={user.attributes.name}>
                            {user.attributes.name}
                        </option>
                    );
                }
            });
        }
        //the name box is set up here, when a name is selected, this.selectName is called.
        //the default setting is a null option with the words "Available Users".  The option
        //is not selectable, and cannot be seen once the user has clicked on the list
        return (
            <select id="selectOptions" ref="selectOptions2" onChange={this.selectName} defaultValue="">
                <option value="" disabled style={{display:"none"}}>Available Users</option>
                {nameNodes}
            </select>
        );
    }
});

//The AddNameBar allows the user to enter his name to log in
//Once the user has logged in, (or if he was already logged in from a
// previous session, his username will be in the form, and it will
//be disabled.
var AddNameBar = React.createClass({
    //used to handle the event when a user enters his name
    handleSubmit: function(e) {
        e.preventDefault();//this is kinda like override
        var name = React.findDOMNode(this.refs.nameTextInput).value.trim();
        if (!name) {
            return;
        }
        //here we call a function defined in MainArea, which will
        //do all of the heavy lifting of setting the user's name
        //and sending it out to the rest of the world.
        this.props.onNameSubmit({name: name});
        return;
	},
    render: function() {
        var _this = this;
        //we set up the basic form for our bar.  If the username is already set,
        //then we return a readonly/disabled bar with the username, otherwise,
        //it is a normal form.
        if (!_this.props.thisUserName || _this.props.thisUserName == "") {
            return (
                <form id="nameForm" onSubmit={this.handleSubmit}>
                    Name:
                    <input id="nameFormText" type="text" placeholder="e.g. WillC..." ref="nameTextInput"/>
                </form>
            );
        }
        else{
            return (
                <form id="nameForm" onSubmit={this.handleSubmit}>
                    Name:
                    <input id="nameFormText" type="text" value={_this.props.thisUserName} readOnly ref="nameTextInput"/>
                </form>
            );
        }
    }
});


//now we enter the lower portion of the page, where all the chat boxes will reside.
//Each ChatBox consists of an upper section, where the chat partner's name and
//the close button reside, a middle section, where the text of the conversation
//is shown, and a lower part, where new text may be entered.


//the ChatForm is where new text may be entered.
var ChatForm = React.createClass({
    //as soon as the component mounts,
    //in order to forgo a "submit" button, we bind the enter key to
    //submit the form
    componentDidMount: function(){
        var _this = this;
        $("#chatFormInput"+this.props.data.idnum).keypress(function (e) {
            if(e.which == 13) {
                _this.handleSubmit();
                $(this).val("");
                e.preventDefault();
            }
        });
    },
	handleSubmit: function() {
		//e.preventDefault();//this is kinda like override
		var text = React.findDOMNode(this.refs.chatText).value.trim();
		if (!text) {
			return;
		}
        //this function is fully defined in MainArea
		this.props.onChatSubmit({text: text});
        //reset the form to be empty after the user has submitted his text
		React.findDOMNode(this.refs.chatText).value = '';
		return;
	},
	render: function() {
        //our form is a textarea because I wanted to be able to have several lines visible at once
        //and to be able to have a scrollbar, not just type out to infinity
		return (
			<form onSubmit={this.handleSubmit}>
				<textarea className="chatFormInput" id={"chatFormInput"+this.props.data.idnum} type="text" ref="chatText" rows="2"></textarea>
			</form>
		);
	}
});


//The ChatArea contains the text of the conversation.  When text is
//submitted from either conversant, it will be put here, as well as
//the contents of their previous conversation.  If the other user disconnects
//a message will also be shown here, as will the time that the conversation started.
var ChatArea = React.createClass({
    //when the component mounts, we want to fill it with the contents of the previous
    //conversation between these two, if it exists.  We prepend, because we want it at the beginning,
    //before the time of the conversation starting.
    //And then we ensure that we are scrolled down to the bottom of the conversation to start with.
    componentDidMount: function(){
        $('#thisChatField'+this.props.data.idnum).prepend(this.props.data.conversation.attributes.text);
        $("#thisChatField" + this.props.data.idnum).scrollTop($("#thisChatField" + this.props.data.idnum)[0].scrollHeight);//ensures we always see new content
    },
    //a simple function to get the current time
    gettime: function(){
        var d = new Date();
        var h = d.getHours();
        h = (h > 12) ? h-12 : h;
        h = (h == 0) ? 12 : h;
        var hours = this.checktime(h);
        var minutes = this.checktime(d.getMinutes());
        return hours + ":" + minutes;
    },
    //a simple function to provide nice looking times
    checktime: function(i) {
        return (i < 10) ? "0" + i : i;
    },
    render: function(){
        //nothing special here other than that we include the beginning time of the conversation
        return(
            <p className="chatTextField" id={"thisChatField"+this.props.data.idnum} wrap="logical">
                <br/><span style={{color:"purple"}}>Conversation began at {this.gettime()}</span>
            </p>
        );
    }
});


//a very simply class that only contains the name of the person you're talking to.
var ChatBoxNameBar = React.createClass({
   render: function(){
       return(
           <p className="chatBoxNameBar" id={"ChatBoxNameBarText"+this.props.data.idnum}>{this.props.data.name}</p>
       )
   }
});


//the main function of the chat area is the chat box.
var ChatBox = React.createClass({
    //when the component mounts we add on two handlers, listening for new messages and the partner leaving
    //we also immediately focus the window on the input area when the box is loaded.
    componentDidMount: function() {
        socket.on('parsed chat message', this.displayMessage);
        socket.on('closed chat', this.partnerLeft);
        $('#chatFormInput' + this.props.data.idnum).focus();
    },
    //when we click on the close button of the chatbox, we want to close it,
    //which means unmounting it.  When we unmount it, the function componentWillUnmount is called
    handleClose: function () {
        React.unmountComponentAtNode(document.getElementById('chatArea'+this.props.data.idnum));
    },
    //when we submit a chat, we send out a message to the server that a new message has
    //been sent by this person, in this conversation (i.e. roomName), with this text.
    //The server then sends back a message to both members of the conversation that
    //a new message has been sent.  This is caught by the socket.on('parsed chat message')
    //handler, set up in componentDidMount, which then calls displayMessage
    handleChatSubmit: function(text){
        //console.log("Sending message to room: " + this.props.data.roomName);
        socket.emit('new chat message',
            {'text': text.text, 'author': this.props.data.thisUserName, 'roomName': this.props.data.roomName});
    },
    //we display the message, first making sure that the message actually belongs to this conversation.
    //The author's name is in blue, and the text in black.  Then we ensure that we are
    //scrolled to the bottom of the chatfield.  Finally, we add the message to our conversation
    //which is then saved into the user's browser storage, using the backbone.localstorage method
    displayMessage: function(msg){
        var _this = this;
        if (msg.roomName == _this.props.data.roomName) {//ensures that messages are only displayed in the correct chatbox
            $('#thisChatField' + _this.props.data.idnum).append('<br> <span style="color:blue">' + msg.author + "</span>: " + msg.text);
            $("#thisChatField" + _this.props.data.idnum).scrollTop($("#thisChatField" + _this.props.data.idnum)[0].scrollHeight);//ensures we always see new content
            this.props.data.conversation.attributes.text = this.props.data.conversation.attributes.text +
                '<br> <span style="color:blue">' + msg.author + "</span>: " + msg.text;
            this.props.data.conversation.save();
        }
    },
    //when the partner leaves the conversation, either by closing their chatbox, logging off, or closing their
    //browser's tab/window, we display a message in red that the user has left, and disable their ability to
    //write new messages.  If the user leaves his chatbox open and the partner re-opens up a chat with him,
    //the textbox will become enabled again.
    partnerLeft: function(msg){
        var _this = this;
        if (msg.roomName == _this.props.data.roomName) {//ensures that messages are only displayed in the correct chatbox
            $('#thisChatField' + _this.props.data.idnum).append('<br> <span style="color:red">' + msg.author + " has closed the chatbox</span>");
            $("#thisChatField" + _this.props.data.idnum).scrollTop($("#thisChatField" + _this.props.data.idnum)[0].scrollHeight);//ensures we always see new content
            $("#chatFormInput" + _this.props.data.idnum).attr("disabled",true);
        }
    },
    //when the component is going to be destroyed, we let the partner know, remove the partner
    //from the list of currently active partners, and remove the two listeners.
    componentWillUnmount: function() {
        socket.emit('close chat',{'roomName': this.props.data.roomName, 'author': this.props.data.thisUserName});
        this.props.data.myPartnerList.remove(this.props.data.name);
        socket.removeListener('parsed chat message',this.displayMessage);//remove the socket listener when we close a chatbox
        socket.removeListener('closed chat',this.partnerLeft);//remove the socket listener when we close a chatbox
    },
    render: function(){
        //sets up the chatbox, the name is on top with the close button next to it, then the chat area and
        //the input area
        return(
            <div className="chatBox" id={"chatBox"+this.props.data.idnum}>
                <ChatBoxNameBar data={this.props.data} />
                <button className="chatBoxButton" id={"chatBoxButton"+this.props.data.idnum} onClick={this.handleClose} >X</button>
                <ChatArea data={this.props.data}/>
                <ChatForm data = {this.props.data} onChatSubmit={this.handleChatSubmit} />
            </div>
        );
    }
});


//The main guy who runs the whole show.  Everything that happens on the webpage goes through
//MainArea.  It sets everything up, contains most of the functions that runs things,
//and is the only React class to contain state data, all the others only deal with props.
//The state data here is the lists of users, partners and conversations, as well
//as the user's name.
var MainArea = React.createClass({
    //We set the state data before actually rendering anything.
    //the main thing to note here is the setting of thisUserName
    //if it already exists in the localStorage
    getInitialState: function() {
        if (localStorage.name) {
            return {data: [],thisUserName: localStorage.name};
        }
        else{
            return {data: []};
        }
    },
    //when we mount at the beginning, we set up all the state variables.
    //I'll describe the rest in-line
    componentDidMount: function() {
        var myUserList = new UserList();
        this.setState({data: myUserList});

        //if we've already got a name, then we send that out to the world
        //and ask for responses
        if (localStorage.name){
            socket.emit('new user', {data: this.state.thisUserName});
            socket.on('current user message',this.add_current_user);
        }

        //the idtag is used to give each chat a unique name
        this.setState({idtag: 0});

        var myPartnerList = new PartnerList();
        this.setState({myPartnerList: myPartnerList});
        var myConversationList = new ConversationList();
        myConversationList.fetch();//this reads the data kept in the browser
        this.setState({myConversationList: myConversationList});
        var _this = this;

        //Turning on a few listeners
        socket.on('new_user_message',this.new_user_added);
        socket.on('new_chat_invitation', _this.new_chat_invitation);
        socket.on('user left',_this.remove_user);

        //This is a listener for when the window closes (or reloads)
        //we want to let the world know we're leaving, and turn off all our listeners,
        //and unmount any ongoing chats, which will let the users know we've left,
        //so we unmount and let this.componentWillUnmount take care of the details
        //for us.  If we want an alert box to stop the user from leaving the page
        //we can uncomment the "return" line.
        window.onbeforeunload = function () {
            React.unmountComponentAtNode(document.getElementById('content3'));
            //return "you really want to close?";
        };
    },
    //When a user submits their name back up in the AddNameBar class, this is the function that
    //is called.  We first check whether or not someone is already using that name (the
    //user would have to be currently active, as the server does not have any list of names)
    //and if it is we alert them and tell them to choose another name.  But once they've
    //chosen a unique name, we add them to the list of users, alert the world that they've
    //signed in, turn on a handler to listen for the users to respond to that message and
    //tell him their names, which will then be processed and added to the user list by add_current_user.
    //finally we set the name into localstorage so it will persist in this browser, and
    //set the addnamebar to readonly.
    handleNameSubmit: function(name) {
        var _this = this;
        var myUserList = this.state.data;
        if (!myUserList.get(name.name)) {
            myUserList.add({name: name.name, id: name.name});
            socket.emit('new user', {data: name.name});
            socket.on('current user message', _this.add_current_user);
            _this.setState({thisUserName: name.name});
            localStorage.name = name.name;
            document.getElementById("nameFormText").readOnly = true;
        }
        else{
            alert("Someone else has chosen that username already, please select another");
            $('#nameFormText').focus();
        }
    },
    //When a new user event happens, we call this function.
    //We start by letting the new user know our name.  Then we
    //add this new user to the userlist and update the state.
    new_user_added: function(msg){
        console.log("New user added: "+msg.name);
        var _this = this;
        if (this.state.thisUserName) {
            socket.emit("new user response", {name: _this.state.thisUserName});
        }
        var myUserList = this.state.data;
        if (!myUserList.get(msg.name)) {
            myUserList.add({name: msg.name, id: msg.name});
        }
        this.setState({data: myUserList});
    },
    //When we first sign in we ask for all the other users to send their
    //names, and this is called when we get a response.  Technically, it is
    //never turned off, so everytime a new user comes on board everybody
    //hears everyone else's name again.  But it is not too much of a hardship.
    //We just add then to the list if they aren't already there.
    add_current_user: function(msg){
        console.log("Adding current user "+msg.name);
        var myUserList = this.state.data;
        if (!myUserList.get(msg.name)) {
            myUserList.add({name: msg.name, id: msg.name});
        }
        this.setState({data: myUserList});
    },
    //when a user leaves, we remove them from our list
    remove_user: function(msg){
        var myUserList = this.state.data;
        myUserList.remove(msg.name);
        this.setState({data: myUserList});
    },
    //When the user receives an invitation to chat from someone, we use this function.
    //First, we check if the invitation is really to this user, then we check whether
    //or not we currently have a chat open with them.  If we do, then we have to enable
    //the chat input area, but otherwise do nothing.  But if it is a new chat partner,
    //then we accept the invite and begin the chat
    new_chat_invitation: function(msg){
        _this = this;
        if (msg.toName == this.state.thisUserName) {
            console.log("Incoming chat from: " + msg.fromName);
            if (_this.state.myPartnerList.get(msg.fromName)){
                var partner = _this.state.myPartnerList.get(msg.fromName);
                $("#chatFormInput" + partner.attributes.idnum).attr("disabled",false);
            }
            else {
                socket.emit('accept chat', {fromName: msg.fromName, toName: msg.toName});

                _this.begin_chat(msg.fromName,msg.fromName + msg.toName);
            }
        }
    },
    //When a name is selected from the NameList, we come here to begin the
    //actual chat.  We start by checking to see if there is a conversation history
    //between these two users, and if there is, then we call it conversation.
    //Since I have left open the possibility of two users using the same browser
    //with different names, I have included thisUserName as part of the key
    //to get the conversation.  So if two users both have conversations with
    //a single other user, the conversation will be kept separate.
    //
    //Then we add the partner to the partnerList.  And then we create a new div
    //where this chat can reside, it is given a unique id by the idtag state variable.
    //Then we render the chatbox, and set all of our state variables that we have changed
    begin_chat: function(partnerName,roomName){
        var thisUserName = this.state.thisUserName;
        var myConversationList = this.state.myConversationList;
        var conversation = myConversationList.get(thisUserName+partnerName);
        if (!conversation){
            console.log("No Previous Conversations");
            myConversationList.add({
                name: thisUserName,
                partner: partnerName,
                id: thisUserName+partnerName,
                test: ""
            })
            conversation = myConversationList.get(thisUserName+partnerName);
            conversation.save();
        }
        else{
            console.log("Found previous conversation");
        }

        var myPartnerList = this.state.myPartnerList;
        myPartnerList.add({name: partnerName, id: partnerName, idnum: this.state.idtag});
        var chatPartner = {
            name: partnerName,
            roomName: roomName,
            idnum: this.state.idtag,
            conversation: conversation,
            thisUserName: thisUserName,
            myPartnerList: myPartnerList
        };
        $('#chatArea').append('<div className="chatAreaClass" id="chatArea' + this.state.idtag + '"></div>');
        React.render(
            <ChatBox data={chatPartner}/>,
            document.getElementById('chatArea' + this.state.idtag)
        );
        var _this = this;
        this.setState({idtag: _this.state.idtag+1});
        this.setState({myConversationList: myConversationList});
        this.setState({myPartnerList: myPartnerList});
    },
    //If a user wants to log out, so that they can reset their name, or allow
    //someone else to log in, they can do it here.  Technically this project is
    //not supposed to have this function, but it was very necessary when debugging
    //and testing, so I have left it in, whether or not the actual button is shown.
    //All it does is to set localStorage.name to a blank string, send out a message
    //that the user is leaving (which will remove it from others' userlists), and
    //then re-render the mainarea.  The point of the re-render is to ensure that
    //any open chats get closed, with appropriate messages going out to their
    //partners, and all the listeners removed.
    logout: function () {
        localStorage.name = "";
        if (this.state.thisUserName) {
            socket.emit('user leaving', {name: this.state.thisUserName});
        }
        React.unmountComponentAtNode(document.getElementById('content3'));
        React.render(
            <MainArea url="registeredUsers.json" />,
            document.getElementById('content3')
        );
    },
    //we want to let the world know we're leaving, and turn off all our listeners,
    //and unmount any ongoing chats, which will let the users know we've left
    componentWillUnmount: function(){
        this.state.myPartnerList.reset();
        if (this.state.thisUserName) {
            socket.emit('user leaving', {name: this.state.thisUserName});
        }
        socket.removeListener('new_user_message',this.new_user_added);
        socket.removeListener('new_chat_invitation',this.new_chat_invitation);
        socket.removeListener('current user message',this.add_current_user);
        socket.removeListener('user left',this.remove_user);
        for (i = 0; i < this.state.idtag; i++) {
            React.unmountComponentAtNode(document.getElementById('chatArea' + i));
        }
    },
    render: function() {
        //create the main area.
        return (
            <div id="mainArea">
                <h1 id="mainTitle">Chat Server</h1>
                <div id="searchBarArea">
                    <div id="searchBar">
                        <AddNameBar
                            onNameSubmit={this.handleNameSubmit}
                            data={this.state.data}
                            thisUserName={this.state.thisUserName}
                            />
                    </div>
                    <div id="selectBox">
                        Start a conversation:
                        <NameList data={this.state.data}
                                 thisUserName={this.state.thisUserName}
                                 myPartnerList={this.state.myPartnerList}
                                 beginChat={this.begin_chat}
                            />
                    </div>
                </div>
                <div id="chatArea">
                </div>
            </div>
        );
    }
});

//This is technically the only piece of active code in this whole file.
//Here we actually render the main area.
React.render(
    <MainArea url="registeredUsers.json" />,
    document.getElementById('content3')
);

