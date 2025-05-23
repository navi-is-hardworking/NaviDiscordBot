
class Role:
    system = "system"
    event = "# NOTIFICATION: "
    user = "user"
    assistant = "assistant"

class Message:
    def __init__(self, role: str, content: str, name: str = ""):
        self.role: str = role
        self.content: str = content
        self.name: str = name
        
    def serialize_usermessage(self):
        if self.role == Role.event:
            return self.role + self.content
        elif self.role == Role.user:
            return "<" + self.name + ">: " + self.content
        else:
            return self.content
    
    def to_dict(self):
        return {"role": self.role, "content": self.serialize_usermessage()}