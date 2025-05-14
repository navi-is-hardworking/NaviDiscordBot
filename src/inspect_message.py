import discord
from inspect import ismethod, isfunction
from logger import log

def inspect_message(message: discord.Message):
    log.debug("\n=== DISCORD MESSAGE STRUCTURE ===")
    
    log.debug(f"message.id: {message.id} (type: {type(message.id).__name__})")
    log.debug(f"message.content: {message.content} (type: {type(message.content).__name__})")
    log.debug(f"message.clean_content: {message.clean_content} (type: {type(message.clean_content).__name__})")
    log.debug(f"message.created_at: {message.created_at} (type: {type(message.created_at).__name__})")
    
    log.debug("\n--- Author ---")
    log.debug(f"message.author: {message.author} (type: {type(message.author).__name__})")
    log.debug(f"message.author.id: {message.author.id} (type: {type(message.author.id).__name__})")
    log.debug(f"message.author.name: {message.author.name} (type: {type(message.author.name).__name__})")
    log.debug(f"message.author.display_name: {message.author.display_name} (type: {type(message.author.display_name).__name__})")
    log.debug(f"message.author.bot: {message.author.bot} (type: {type(message.author.bot).__name__})")
    
    log.debug("\n--- Channel ---")
    log.debug(f"message.channel: {message.channel} (type: {type(message.channel).__name__})")
    log.debug(f"message.channel.id: {message.channel.id} (type: {type(message.channel.id).__name__})")
    log.debug(f"message.channel.name: {message.channel.name} (type: {type(message.channel.name).__name__})")
    
    log.debug("\n--- Guild ---")
    log.debug(f"message.guild: {message.guild} (type: {type(message.guild).__name__})")
    if message.guild:
        log.debug(f"message.guild.id: {message.guild.id} (type: {type(message.guild.id).__name__})")
        log.debug(f"message.guild.name: {message.guild.name} (type: {type(message.guild.name).__name__})")
    
    log.debug("\n--- Mentions ---")
    log.debug(f"message.mentions: {message.mentions} (type: {type(message.mentions).__name__})")
    log.debug(f"message.role_mentions: {message.role_mentions} (type: {type(message.role_mentions).__name__})")
    log.debug(f"message.channel_mentions: {message.channel_mentions} (type: {type(message.channel_mentions).__name__})")
    
    log.debug("\n--- Attachments & Embeds ---")
    log.debug(f"message.attachments: {message.attachments} (type: {type(message.attachments).__name__})")
    if message.attachments:
        att = message.attachments[0]
        log.debug(f"  First attachment: {att.filename} (type: {type(att).__name__})")
        log.debug(f"  attachment.url: {att.url} (type: {type(att.url).__name__})")
        log.debug(f"  attachment.size: {att.size} (type: {type(att.size).__name__})")
    
    log.debug(f"message.embeds: {message.embeds} (type: {type(message.embeds).__name__})")
    
    log.debug("\n--- Reply Reference ---")
    log.debug(f"message.reference: {message.reference} (type: {type(message.reference).__name__})")
    if hasattr(message, 'referenced_message') and message.referenced_message:
        log.debug(f"message.referenced_message: {message.referenced_message} (type: {type(message.referenced_message).__name__})")