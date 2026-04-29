module.exports = {
  meta: {
    name: "character",
    aliases: ["char","personality"],
    category: "games",
    cooldownSeconds: 5,
    access: "user",
    chat: "both",
    description: "Analyze someone's personality for fun"
  },

  async execute(ctx) {

    const client = ctx.client || ctx.sock || ctx.conn;
    const msg = ctx.msg;
    const jid =
      msg?.key?.remoteJid ||
      ctx.from;

    if (!client?.sendMessage) {
      return ctx.reply(
        "❌ WhatsApp client unavailable."
      );
    }

    try {

      let userToAnalyze;
      
      if (
        msg?.message?.extendedTextMessage
          ?.contextInfo?.mentionedJid?.length
      ) {
        userToAnalyze =
          msg.message.extendedTextMessage
            .contextInfo.mentionedJid[0];
      }

    
      else if (
        msg?.message?.extendedTextMessage
          ?.contextInfo?.participant
      ) {
        userToAnalyze =
          msg.message.extendedTextMessage
            .contextInfo.participant;
      }

      if (!userToAnalyze) {
        return ctx.reply(
          "❗ Mention someone or reply to a message."
        );
      }

      
      function seed(str){
        let h=0;
        for(let i=0;i<str.length;i++){
          h=((h<<5)-h)+str.charCodeAt(i);
          h|=0;
        }
        return Math.abs(h);
      }

      const s = seed(userToAnalyze);

      function rand(n, offset=1){
        return ((s * offset) % n);
      }

      let profilePic;

      try{
        profilePic =
          await client.profilePictureUrl(
            userToAnalyze,
            "image"
          );
      } catch{
        profilePic =
          "https://i.imgur.com/2wzGhpF.jpeg";
      }

      const traits = [
        "Intelligent",
        "Creative",
        "Determined",
        "Ambitious",
        "Caring",
        "Charismatic",
        "Confident",
        "Empathetic",
        "Energetic",
        "Friendly",
        "Generous",
        "Honest",
        "Humorous",
        "Independent",
        "Intuitive",
        "Kind",
        "Logical",
        "Loyal",
        "Optimistic",
        "Passionate",
        "Patient",
        "Persistent",
        "Reliable",
        "Wise"
      ];

      
      const selected = [];

      let i=1;
      while(selected.length < 4){
        const t =
          traits[rand(
            traits.length,
            i++
          )];

        if(!selected.includes(t)){
          selected.push(t);
        }
      }

      const scores = selected.map(
        (t,idx)=>
`${t}: ${60 + rand(41,idx+7)}%`
      );

      const overall =
        80 + rand(21,55);

      const analysis =
`🔮 *Character Analysis*

👤 User:
@${userToAnalyze.split("@")[0]}

✨ Key Traits:
${scores.join("\n")}

🎯 Overall Rating:
${overall}%

⚠️ Just for fun.
`;

      return await client.sendMessage(
        jid,
        {
          image: { url: profilePic },
          caption: analysis,
          mentions: [userToAnalyze]
        },
        { quoted: msg }
      );

    } catch(error){

      console.error(
        "Character fun error:",
        error
      );

      return ctx.reply(
        "❌ Failed to analyze character."
      );
    }
  }
};
