# Paratext extension \- Export to FLEx

# Problem statement:

When someone wants to translate a text using FLExTrans, the first step is to import it into FLEx. If that text is scripture, it would be nice if the user could from within Paratext run a command that would export a desired portion of scripture to FLEx. The key is remaining in Paratext.

# Existing solution:

Right new the solution is to start FLExTools, select the Import from Paratext module, adjust the settings and click OK.

# Big idea:

The idea is to create a Paratext 10 Studio extension that would do the same thing as what the FLExTrans module is doing.

## Writing System Assignment

One could just copy a chapter from Paratext and paste it into a new FLEx text, but the big value that the current module gives is that it sorts out which parts of the chapter data are vernacular text and which are not. This new extension should do the same thing. This prevents all the hassles that come with processing text that is not vernacular and not in the lexicon.

## Current Module Screenshots

![Import Dialog](images\FLExTools Import Dialog.png)  
Here’s a sample import of MRK 1  
![Import Sample](images\Example Import in FLEx.png)

## ![][image4]

## Disregard Cluster Projects

The FLExTrans module has logic for dealing with cluster projects, i.e. being able to bring the same text from multiple Paratext projects into multiple FLEx projects.  
The initial version of this extension will only deal with the current Paratext project.

## Code

The module code is located in the file ImportFromParatext.py and makes use of common code in ChapterSelection.py

## Identifying the FLEx Project

Ideally the FLEx project that is associated with the Paratext project would be used, but Paratext 10 may not have this functionality yet. So some sort of setting may have to be established within the extension for the FLEx Project name. (Text Title Book Abbreviation or Full Book name (Interface Language?) 

## Options

All the options in the above dialog, except Paratext project and book abbreviation should be possible in the new extension. 

Overwrite: (same text name or “copy 1”)

Use SFM structure when importing.

Keep round-tripping in mind.

Whole Chapter or Multiple chapter chunks

Largest chunk is a book.

Persistence for Project and Options

Default to current book/chapter (john 3,3), allow selecting other book

Intro is chapter 1, verse 0

SFM tagged as first analysis language.

Default Vernacular (picking is future)

Future (Trigger FLEx opening or browsing to text  
Future Apply Paratext Changes

Ready for Localization 

## Stack

Typescript for the Plugin  
Internal Testing 

## Prereqs

Paratext 10 Installed  
FLEx Installed  
Windows Only for Now.   
**FLExTools/Python not required (for this).**

## Meta-Discussion

Doug told me yesterday that Paratext 10 is currently only being funded (ETEN) as a replacement for Paratext 9, not going beyond that in functionality. Apparently they’re looking at something called Fluent as the future. This means that the plugin marketplace idea is dead for now. We can still build a plugin, but we won’t get dev support and I’m not sure how we’d distribute it.

