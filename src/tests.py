

#%%


# Queue length #%%

import re


pattern = re.compile(r'\W', re.IGNORECASE)

text = "this is some :text: for you to read123"

text = text.split(' ')
text = [pattern.sub("", t) for t in text]

print(text)

#%%

import re

pattern = re.compile(r'\W', re.IGNORECASE)
def static_search(username: str, message: str):
    words = [pattern.sub("", t) for t in message.lower().split(' ')]
    words.append(username.lower())
    
    print(words)

static_search("test:123", "this is some :text: for you to read123?")
    

    
#%%

from TLRUCache import TLRUCache
import time
import times

cache = TLRUCache(capacity=3, cache_clear_time=times.seconds(2))

cache.append("test1")
time.sleep(times.seconds(1))

cache.append("test1")
time.sleep(times.seconds(0.5))
cache.append("test2")
time.sleep(times.seconds(0.5))
cache.append("test3")
time.sleep(times.seconds(0.5))

## should be 2 seconds left before test1 is removed

if (cache.as_string() == "test1\ntest2\ntest3"):
    print("passed test 1")
else:
    print("failed test 1")
print()

# elapsed at this point is 1+.5+.5+.5=2.5 seconds
time.sleep(times.seconds(0.3))

if (cache.as_string() == "test1\ntest2\ntest3"):
    print("passed test 2")
else:
    print("failed test 2")
print()

time.sleep(times.seconds(0.3)) 
## elapsed time since test 1/2/3 is now 2.1/1.6/1.1
if (cache.as_string() == "test2\ntest3"): ## test2\ntest3
    print("passed key 1 expired")
else:
    print("failed key 1 expired test")
    print(cache.as_string())
    print(cache.get_key_age("test1"))
    
time.sleep(times.seconds(0.5)) 
## elapsed time since test 1/2/3 is now 2.6/2.1/1.6
if (cache.as_string() == "test3"): ## test3
    print("passed key 2 expired")
else:
    print("failed key 2 expired test")
    print(cache.as_string())
    print(cache.get_key_age("test2"))

time.sleep(times.seconds(0.5)) 
## elapsed time since test 1/2/3 is now 3.1/2.6/2.1
if (cache.as_string() == ""): ## test3
    print("passed key 3 expired")
else:
    print("failed key 3 expired test")
    print(cache.as_string())
    print(cache.get_key_age("test3"))

print()
    


#%%
########### Bounded Queue Tests #############

from message_queue import *

configuration_dict={}
configuration_dict['max_context_length']=15
configuration_dict['min_context_length']=5

q = MessageQueue(15, 5)
q.append("user", "1", "23456789") # len is 10
print(q.to_list())
print()

q.append("user", "2", "1234") # len is 14
print(len(q.to_list()))
print(q.to_list())

# 
q.truncate_to_min()
print(q.to_list())

