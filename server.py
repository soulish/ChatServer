###author: Brian Vernarsky

#Chat Server Project for expii

#this file contains all the server side stuff.  In order for users to interact with one
#another, they send sockets to the server, which in turns sends messages back out to
#the other users.  Most of the @socketio.on commands contain their own emit functions
#to send things back to the users, although they don't have to.


#imports
import json
from gevent import monkey
monkey.patch_all()

from flask import Flask, Response, request, render_template, session
from flask.ext.socketio import SocketIO, emit, join_room, leave_room, \
    close_room, disconnect

#create a variable called app, which is a flask object, and points to the folder 'public', where
#the index.html file is located, which sets up our page.
app = Flask(__name__, static_url_path='', static_folder='public')
app.add_url_rule('/', 'root', lambda: app.send_static_file('index.html'))
app.debug = False
app.config['SECRET_KEY'] = 'secret!'

#create the socketio variable, which will be our main variable
socketio = SocketIO(app)

#all the socket handlers
@socketio.on('new user', namespace='/test')
def new_user_message(user_name):
    emit('new_user_message',{'name': user_name['data']},broadcast=True)


@socketio.on('new user response', namespace='/test')
def new_user_response_message(msg):
    emit('current user message',{'name': msg['name']}, broadcast=True)


@socketio.on('user leaving', namespace='/test')
def user_leaving(user_name):
    emit('user left',{'name': user_name['name']},broadcast=True)


@socketio.on('new chat', namespace='/test')
def new_chat_invitation(data):
    join_room(data['fromName']+data['toName'])
    emit('new_chat_invitation',{'fromName': data['fromName'], 'toName': data['toName']},broadcast=True)

@socketio.on('accept chat', namespace='/test')
def accept_chat_invitation(data):
    join_room(data['fromName']+data['toName'])
    emit('chat accepted',{'roomName': data['fromName']+data['toName']},room=data['fromName']+data['toName'])


@socketio.on('new chat message', namespace='/test')
def receive_new_chat_message(data):
    emit('parsed chat message',{'text': data['text'], 'author': data['author'], 'roomName': data['roomName']},room=data['roomName'])

@socketio.on('close chat', namespace='/test')
def leave(message):
    leave_room(message['roomName'])
    emit('closed chat',{'roomName': message['roomName'], 'author': message['author']},room=message['roomName'])


#Here is where we actually launch our server, with all of the handlers turned on.
#the host="0.0.0.0" is there to make this visible to all users on the local network
if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0")
